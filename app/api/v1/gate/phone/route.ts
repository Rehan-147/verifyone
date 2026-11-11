// PRE-DIAL GATE — the one call an AI dialer makes before every call.
// POST /api/v1/gate/phone { phone, channel?, consent?, profile? }
// -> { decision: ALLOW|DENY, reason, evidence_id, ... }
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPhoneGate } from '../../../../../lib/gate';
import { sealEvidence, checkAndBumpQuota, saveTicket } from '../../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable } from '../../../../../lib/auth';
import { formatPublicGateResponse } from '../../../../../lib/gate-contract';
import { gateBundleCredits, resolveGateProfile } from '../../../../../lib/credits';
import { evaluateShieldReadiness } from '../../../../../lib/compliance-policy';
import { buildDataSourceReceipts } from '../../../../../lib/compliance-cache';

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
  const started = Date.now();

  const ip = req.headers.get('x-forwarded-for') || 'local';
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

  const auth = req.headers.get('authorization') || '';
  const apiKey = req.headers.get('x-api-key') || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  const callerKey = apiKey || 'ip:' + ip;
  const acc = await authenticate(req);
  if (acc && !creditsAvailable(acc)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing', message: 'Credit balance is empty — upgrade at /pricing to keep gating calls.' }, { status: 402 });
  }

  let plan = 'FREE';
  let usage = { used: 0, limit: 500 };
  let creditsLeft: number | undefined;

  if (acc) {
    const m = await meter(acc, bundleCredits);
    plan = acc.plan;
    creditsLeft = m.creditsLeft;
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

  const result = await Promise.race([
    runPhoneGate({
      phone: String(body.phone),
      channel: body.channel === 'sms' ? 'sms' : 'voice',
      consent: body.consent as GateInputConsent,
      mode: body.mode === 'fail_open' ? 'fail_open' : 'fail_closed',
      debug_now: body.debug_now as string | undefined,
      profile,
      live_hlr: body.live_hlr === true,
    }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('gate_timeout')), gateTimeoutMs)),
  ]).catch(() => {
    if (body.mode === 'fail_open') {
      return {
        decision: 'allow' as const,
        reason: 'fail_open_gate_unavailable',
        mode: 'fail_open',
        degraded: true,
        profile,
        upstream_live: false,
        checks: {
          valid_number: false,
          line_type: 'unknown' as const,
          disconnected: false,
          litigator: { hit: false },
          dnc: { listed: false, source: 'unavailable' },
          reassigned: { reassigned: false, status: 'unavailable' as const },
          consent: {
            declared: !!(body.consent as { declared?: boolean })?.declared,
            type: (body.consent as { type?: string })?.type || 'none',
            sufficient_for_ai: (body.consent as { type?: string })?.type === 'express_written',
          },
          calling_hours: { applicable: false },
        },
        verified_at: new Date().toISOString(),
        fresh_for_hours: 1,
        evidence_id: '',
        risk_score: 50,
      };
    }
    return {
      decision: 'block' as const,
      reason: 'gate_unavailable_fail_closed',
      mode: 'fail_closed',
      degraded: true,
      profile,
      upstream_live: false,
      checks: {} as import('../../../../../lib/gate').GateChecks,
      verified_at: new Date().toISOString(),
      fresh_for_hours: 1,
      evidence_id: '',
      risk_score: 50,
    };
  });

  if (body.async === true) {
    const ticket_id = 'gt_' + crypto.randomUUID().slice(0, 12);
    const { evidence, persistence } = await sealEvidence({
      phone: String(body.phone),
      channel: body.channel === 'sms' ? 'sms' : 'voice',
      consent: (body.consent as GateInputConsent) ?? { declared: false, type: 'none' },
      decision: result.decision,
      reason: result.reason,
      checks: result.checks,
      callerKey,
    });
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

  const { evidence, persistence } = await sealEvidence({
    phone: String(body.phone),
    channel: body.channel === 'sms' ? 'sms' : 'voice',
    consent: (body.consent as GateInputConsent) ?? { declared: false, type: 'none' },
    decision: result.decision,
    reason: result.reason,
    checks: result.checks,
    callerKey,
  });

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
      bundle: { profile, credits_charged: bundleCredits, label: 'AI Outbound Shield Suite' },
      ...(creditsLeft !== undefined ? { credits_left: creditsLeft } : {}),
      audit: { persistence, chain: 'sha256-hash-chained', verify_url: `/api/v1/gate/audit/${evidence.evidence_id}` },
    },
    { headers: CORS },
  );
}
