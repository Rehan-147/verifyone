// PRE-SEND GATE for AI SDRs — check before the agent hits send.
// POST /api/v1/gate/email { email }
import { NextRequest, NextResponse } from 'next/server';
import { runEmailGate } from '../../../../../lib/gate';
import { sealEvidence, checkAndBumpQuota } from '../../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable } from '../../../../../lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = rateLimit('gate:' + ip);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429, headers: CORS });

  let body: any = {};
  try { body = await req.json(); } catch {}
  if (!body.email) {
    return NextResponse.json({ error: 'email_required', message: 'Send { "email": "person@company.com" }' }, { status: 400, headers: CORS });
  }

  const auth = req.headers.get('authorization') || '';
  const apiKey = req.headers.get('x-api-key') || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  const callerKey = apiKey || 'ip:' + ip;
  const acc = await authenticate(req);
  if (acc && !creditsAvailable(acc)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing', message: 'Credit balance is empty — upgrade at /pricing to keep gating calls.' }, { status: 402, headers: CORS });
  }

  let plan = 'FREE';
  let usage = { used: 0, limit: 500 };
  let creditsLeft: number | undefined;

  if (acc) {
    const m = await meter(acc, 1); // email gate = 1 credit
    plan = acc.plan;
    creditsLeft = m.creditsLeft;
  } else {
    const quota = await checkAndBumpQuota(callerKey);
    if (!quota.allowed) {
      return NextResponse.json({ error: 'quota_exceeded', used: quota.used, limit: quota.monthly_limit }, { status: 429, headers: CORS });
    }
    plan = quota.plan;
    usage = { used: quota.used, limit: quota.monthly_limit };
  }

  const result = await runEmailGate(body.email);
  const { evidence } = await sealEvidence({
    phone: body.email, channel: 'email', consent: null,
    decision: result.decision, reason: result.reason, checks: result.checks, callerKey,
  });
  result.evidence_id = evidence.evidence_id;

  return NextResponse.json({
    ...result,
    latency_ms: Date.now() - started,
    plan,
    usage,
    ...(creditsLeft !== undefined ? { credits_left: creditsLeft } : {}),
  }, { headers: CORS });
}
