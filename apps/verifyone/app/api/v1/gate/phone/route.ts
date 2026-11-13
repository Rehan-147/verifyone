// PRE-DIAL GATE — the one call an AI dialer makes before every call.
// POST /api/v1/gate/phone { phone, channel?, consent?, profile? }
// -> { decision: ALLOW|DENY, reason, evidence_id, ... }
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPhoneGateDecision } from '../../../../../lib/gate-service';
import { sealEvidence, checkAndBumpQuota, saveTicket } from '../../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../../lib/auth';
import { formatPublicGateResponse } from '../../../../../lib/gate-contract';
import { gateBundleCredits, resolveGateProfile } from '../../../../../lib/credits';
import { evaluateShieldReadiness } from '../../../../../lib/compliance-policy';
import { buildDataSourceReceipts } from '../../../../../lib/compliance-cache';
import { persistenceUnavailableResponse } from '../../../../../lib/persistence-response';

type GateInputConsent = { declared?: boolean; type?: 'express_written' | 'ebr' | 'none' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401, headers: CORS });
  }

  const started = Date.now();

  const ip = clientIp(req);
  const rl = rateLimit('gate:' + ip);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429, headers: CORS });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body.phone) {
    return NextResponse.json({ error: 'phone_required', message: 'Send { "phone": "+14155552120" }' }, { status: 400, headers: CORS });
  }

  const profile = resolveGateProfile(body as { profile?: string; live_hlr?: boolean });
  const consentIn = (body.consent ?? {}) as Record<string, unknown>;
  const bundleCredits = gateBundleCredits(profile, { trustedform: typeof consentIn.trustedform_cert_url === 'string' });
  const latencyBudgetMs = profile === 'full_stack' ? 800 : 95;
  const gateTimeoutMs = latencyBudgetMs;

  const callerKey = acc?.email || 'ip:' + ip;
  if (acc && !creditsAvailable(acc, bundleCredits)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing', message: 'Credit balance is insufficient for this gate profile — upgrade at /pricing to keep gating calls.' }, { status: 402, headers: CORS });
  }

  let plan = 'FREE';
  let usage = { used: 0, limit: 500 };
  let creditsLeft: number | undefined;

  if (acc) {
    plan = acc.plan;
  } else {
    const quota = await checkAndBumpQuota(callerKey);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: 'quota_exceeded',
          message: `Free tier: ${quota.monthly_limit} gate checks/month. Sign up: POST /api/auth/signup`,
          used: quota.used,
          limit: quota.monthly_limit,
        },
        { status: 429, headers: CORS },
      );
    }
    plan = quota.plan;
    usage = { used: quota.used, limit: quota.monthly_limit };
  }

  const result = await runPhoneGateDecision(body, profile, gateTimeoutMs);

  if (body.async === true) {
    const ticket_id = 'gt_' + crypto.randomUUID().slice(0, 12);
    let sealed;
    try {
      sealed = await sealEvidence({
        phone: String(body.phone),
        channel: body.channel === 'sms' ? 'sms' : 'voice',
        consent: (body.consent as GateInputConsent) ?? { declared: false, type: 'none' },
        decision: result.decision,
        reason: result.reason,
        checks: result.checks,
        callerKey,
      });
    } catch {
      return persistenceUnavailableResponse(CORS);
    }
    const { evidence, persistence } = sealed;
    if (acc && result.reason !== 'gate_unavailable_fail_closed' && result.reason !== 'fail_open_gate_unavailable') {
      const m = await meter(acc, bundleCredits, `/api/v1/gate/phone:${profile}`);
      creditsLeft = m.creditsLeft;
      if (m.race) console.warn('[billing] credit debit race after phone gate decision', { email: acc.email, cost: bundleCredits });
    }
    const pub = formatPublicGateResponse(result, {
      evidence_id: evidence.evidence_id,
      profile,
      bundle_credits: bundleCredits,
      live_hlr: profile === 'full_stack',
      upstream_live: result.upstream_live,
    });
    void saveTicket({
      ticket_id,
      status: 'ready',
      decision: result.decision,
      reason: result.reason,
      evidence_id: evidence.evidence_id,
      phone: String(body.phone),
    });
    return NextResponse.json(
      {
        ...pub,
        ticket_id,
        status: 'ready',
        poll_url: `/api/v1/gate/ticket/${ticket_id}`,
        audit: { persistence, chain: 'sha256-hash-chained' },
      },
      { headers: CORS },
    );
  }

  let sealed;
  try {
    sealed = await sealEvidence({
      phone: String(body.phone),
      channel: body.channel === 'sms' ? 'sms' : 'voice',
      consent: (body.consent as GateInputConsent) ?? { declared: false, type: 'none' },
      decision: result.decision,
      reason: result.reason,
      checks: result.checks,
      callerKey,
    });
  } catch {
    return persistenceUnavailableResponse(CORS);
  }
  const { evidence, persistence } = sealed;
  if (acc && result.reason !== 'gate_unavailable_fail_closed' && result.reason !== 'fail_open_gate_unavailable') {
    const m = await meter(acc, bundleCredits, `/api/v1/gate/phone:${profile}`);
    creditsLeft = m.creditsLeft;
    if (m.race) console.warn('[billing] credit debit race after phone gate decision', { email: acc.email, cost: bundleCredits });
  }

  const pub = formatPublicGateResponse(result, {
    evidence_id: evidence.evidence_id,
    latency_ms: Date.now() - started,
    profile,
    bundle_credits: bundleCredits,
    live_hlr: profile === 'full_stack',
    upstream_live: result.upstream_live,
    data_sources: 'data_sources' in result ? result.data_sources : buildDataSourceReceipts(),
    shield_ready: evaluateShieldReadiness().shield_ready,
    latency_budget_ms: latencyBudgetMs,
  });

  return NextResponse.json(
    {
      ...pub,
      verified_at: result.verified_at,
      fresh_for_hours: result.fresh_for_hours,
      plan,
      usage,
      bundle: { profile, credits_charged: result.reason === 'gate_unavailable_fail_closed' || result.reason === 'fail_open_gate_unavailable' ? 0 : bundleCredits, label: 'AI Outbound Shield Suite' },
      ...(creditsLeft !== undefined ? { credits_left: creditsLeft } : {}),
      audit: { persistence, chain: 'sha256-hash-chained', verify_url: `/api/v1/gate/audit/${evidence.evidence_id}` },
    },
    { headers: CORS },
  );
}
