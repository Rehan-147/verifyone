export const dynamic = 'force-dynamic';

// CLAY HTTP-API COLUMN ENDPOINT
// Clay's "HTTP API" enrichment column POSTs a JSON body per row and maps any
// flat JSON response. This endpoint accepts whatever your Clay body sends and
// returns a flat, Clay-friendly object — one row in, one flat row out.
//
// Clay setup (2 min): docs/integrations/clay.md
// Body examples Clay users send:
//   {"phone": "{{Phone}}" }   or   {"email": "{{Email}}"}   or both
import { NextRequest, NextResponse } from 'next/server';
import { runPhoneGate, runEmailGate } from '../../../../lib/gate';
import { upstreamPhone } from '../../../../lib/upstream';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../lib/auth';
import { sealEvidence, checkAndBumpQuota } from '../../../../lib/audit-store';
import { persistenceUnavailableResponse } from '../../../../lib/persistence-response';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: NextRequest) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401, headers: CORS });
  }

  const ip = clientIp(req);
  if (!rateLimit('clay:' + ip).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS });

  const body = await req.json().catch(() => ({}));
  // Clay sometimes nests the row under `row` or sends keys with different casing
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = body?.[k] ?? body?.row?.[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  };
  const phone = pick('phone', 'Phone', 'phone_number', 'mobile', 'number');
  const email = pick('email', 'Email', 'work_email');

  if (!phone && !email) {
    return NextResponse.json({ error: 'send_phone_or_email', example: { phone: '+14155552671' } }, { status: 400, headers: CORS });
  }

  const cost = phone ? 2 : 1;
  if (acc && !creditsAvailable(acc, cost)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing' }, { status: 402, headers: CORS });
  }
  const callerKey = acc?.email || 'ip:' + ip;
  if (!acc) {
    const quota = await checkAndBumpQuota(callerKey);
    if (!quota.allowed) return NextResponse.json({ error: 'quota_exceeded', signup: '/api/auth/signup' }, { status: 429, headers: CORS });
  }

  const out: Record<string, unknown> = {};
  let billable = true;

  if (phone) {
    const gate = await runPhoneGate({ phone, channel: 'voice', consent: body?.consent });
    if (gate.reason === 'gate_unavailable_fail_closed' || gate.reason === 'fail_open_gate_unavailable') billable = false;
    const detail = await upstreamPhone(phone);
    let evidence;
    try {
      ({ evidence } = await sealEvidence({
        phone, channel: 'voice', consent: body?.consent ?? null,
        decision: gate.decision, reason: gate.reason, checks: gate.checks, callerKey,
      }));
    } catch {
      return persistenceUnavailableResponse(CORS);
    }
    Object.assign(out, {
      vt_gate: gate.decision,
      vt_reason: gate.reason,
      vt_line_type: detail.lineType,
      vt_carrier: detail.carrier,
      vt_valid_phone: detail.valid,
      vt_dnc: gate.checks.dnc.listed,
      vt_litigator: gate.checks.litigator.hit,
      vt_calling_hours_ok: gate.checks.calling_hours.applicable ? gate.checks.calling_hours.allowed : null,
      vt_caller_tz: gate.checks.calling_hours.timezone ?? null,
      vt_phone_risk: detail.riskScore,
      vt_evidence_id: evidence.evidence_id,
      vt_verified_at: gate.verified_at,
    });
  }

  if (email) {
    const eg = await runEmailGate(email);
    if (eg.reason === 'gate_unavailable_fail_closed' || eg.reason === 'fail_open_gate_unavailable') billable = false;
    Object.assign(out, {
      vt_email_gate: eg.decision,
      vt_email_reason: eg.reason,
      vt_email_disposable: eg.checks.disposable,
      vt_email_catch_all: eg.checks.catch_all,
      vt_email_risk: eg.risk_score,
    });
  }

  if (acc && billable) {
    const m = await meter(acc, cost, `/api/clay/enrich:${phone ? 'phone' : 'email'}`);
    if (m.race) console.warn('[billing] credit debit race after Clay enrichment', { email: acc.email, cost });
  }
  return NextResponse.json(out, { headers: CORS });
}
