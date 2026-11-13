export const dynamic = 'force-dynamic';

// POST-CALL OUTCOME — closes the compliance loop.
// An AI agent reports what happened on the call it was allowed to place
// (answered / booked / opt-out …). The outcome is sealed into the same
// hash-chained evidence ledger, so the story for any number reads:
//   gate decision (ev_…) → call → outcome (ev_…)
// Opt-outs recorded here feed internal suppression for future dial attempts.
//
// POST /api/v1/gate/outcome
// { phone, evidence_id? (link to the gate decision), outcome: "connected"|
//   "voicemail"|"booked"|"interested"|"not_interested"|"wrong_number"|
//   "no_answer"|"disconnected"|"opt_out", notes?, consent? }
// -> { decision: "outcome", reason: <outcome>, evidence_id, persistence, audit }
import { NextRequest, NextResponse } from 'next/server';
import { sealEvidence, checkAndBumpQuota, normalizePhone } from '@/lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '@/lib/auth';
import { persistenceUnavailableResponse } from '@/lib/persistence-response';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_OUTCOMES = new Set([
  'connected', 'voicemail', 'booked', 'interested', 'not_interested',
  'wrong_number', 'no_answer', 'disconnected', 'opt_out',
]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401, headers: CORS });
  }

  const ip = clientIp(req);
  const rl = rateLimit('outcome:' + ip, 240);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429, headers: CORS });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  const normalized = phoneRaw ? normalizePhone(phoneRaw) : '';
  if (!/^\+\d{7,15}$/.test(normalized)) {
    return NextResponse.json({ error: 'phone_required', message: 'Send { "phone": "+14155552120" }' }, { status: 400, headers: CORS });
  }

  const outcome = typeof body.outcome === 'string' ? body.outcome.toLowerCase() : '';
  if (!ALLOWED_OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: 'invalid_outcome', allowed: [...ALLOWED_OUTCOMES] }, { status: 400, headers: CORS });
  }

  // Opt-outs are permanent suppressions in spirit — note them louder in the ledger.
  const isOptOut = outcome === 'opt_out';

  if (acc && !creditsAvailable(acc, 1)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing', message: 'Credit balance is empty — upgrade at /pricing to log outcomes.' }, { status: 402, headers: CORS });
  }
  const callerKey = acc?.email || 'ip:' + ip;
  if (!acc) {
    const quota = await checkAndBumpQuota(callerKey);
    if (!quota.allowed) {
      return NextResponse.json({ error: 'quota_exceeded', used: quota.used, limit: quota.monthly_limit }, { status: 429, headers: CORS });
    }
  }

  const gateEvidenceId = typeof body.evidence_id === 'string' ? body.evidence_id : '';
  const consent = (body.consent ?? null) as unknown;

  let sealed;
  try {
    sealed = await sealEvidence({
    phone: normalized,
    channel: 'outcome',
    consent,
    decision: 'outcome',
    reason: isOptOut ? 'opt_out_recorded' : outcome,
    checks: {
      outcome,
      linked_gate_evidence: gateEvidenceId || undefined,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : undefined,
      suppress_henceforth: isOptOut,
    },
      callerKey,
    });
  } catch {
    return persistenceUnavailableResponse(CORS);
  }
  const { evidence, persistence } = sealed;
  if (acc) {
    const m = await meter(acc, 1, '/api/v1/gate/outcome:outcome');
    if (m.race) console.warn('[billing] credit debit race after outcome evidence', { email: acc.email });
  }

  return NextResponse.json(
    {
      decision: 'outcome',
      reason: outcome,
      evidence_id: evidence.evidence_id,
      linked_gate_evidence: gateEvidenceId || null,
      suppress_henceforth: isOptOut,
      persistence,
      audit: {
        chain: 'sha256-hash-chained',
        verify_url: `/api/v1/gate/audit/${evidence.evidence_id}`,
      },
    },
    { status: 201, headers: CORS },
  );
}
