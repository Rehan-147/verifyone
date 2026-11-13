export const dynamic = 'force-dynamic';

// PRE-SEND GATE for AI SDRs — check before the agent hits send.
// POST /api/v1/gate/email { email }
import { NextRequest, NextResponse } from 'next/server';
import { runEmailGate } from '../../../../../lib/gate';
import { sealEvidence, checkAndBumpQuota } from '../../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../../lib/auth';
import { persistenceUnavailableResponse } from '../../../../../lib/persistence-response';

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

  const started = Date.now();
  const ip = clientIp(req);
  const rl = rateLimit('gate:' + ip);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429, headers: CORS });

  let body: any = {};
  try { body = await req.json(); } catch {}
  if (!body.email) {
    return NextResponse.json({ error: 'email_required', message: 'Send { "email": "person@company.com" }' }, { status: 400, headers: CORS });
  }

  const callerKey = acc?.email || 'ip:' + ip;
  if (acc && !creditsAvailable(acc, 1)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing', message: 'Credit balance is empty — upgrade at /pricing to keep gating calls.' }, { status: 402, headers: CORS });
  }

  let plan = 'FREE';
  let usage = { used: 0, limit: 500 };
  let creditsLeft: number | undefined;

  if (acc) {
    plan = acc.plan;
  } else {
    const quota = await checkAndBumpQuota(callerKey);
    if (!quota.allowed) {
      return NextResponse.json({ error: 'quota_exceeded', used: quota.used, limit: quota.monthly_limit }, { status: 429, headers: CORS });
    }
    plan = quota.plan;
    usage = { used: quota.used, limit: quota.monthly_limit };
  }

  const result = await runEmailGate(body.email);
  let sealed;
  try {
    sealed = await sealEvidence({
      phone: body.email, channel: 'email', consent: null,
      decision: result.decision, reason: result.reason, checks: result.checks, callerKey,
    });
  } catch {
    return persistenceUnavailableResponse(CORS);
  }
  const { evidence } = sealed;
  if (acc && result.reason !== 'gate_unavailable_fail_closed' && result.reason !== 'fail_open_gate_unavailable') {
    const m = await meter(acc, 1, '/api/v1/gate/email:email');
    creditsLeft = m.creditsLeft;
    if (m.race) console.warn('[billing] credit debit race after email gate decision', { email: acc.email });
  }
  result.evidence_id = evidence.evidence_id;

  return NextResponse.json({
    ...result,
    latency_ms: Date.now() - started,
    plan,
    usage,
    ...(creditsLeft !== undefined ? { credits_left: creditsLeft } : {}),
  }, { headers: CORS });
}
