// POST /api/v1/gate/batch — LIST PRE-FLIGHT: scrub a whole campaign list before it runs.
// Zero per-call latency for the agent: one batch call upstream, agent dials a pre-cleaned list.
// Body: { items: [{id?, phone}, ...], consent?, channel?, mode? }
// Keyless: max 200 items (free tier). Keyed: max 5,000. Concurrency-limited upstream.
import { NextRequest, NextResponse } from 'next/server';
import { runPhoneGate } from '../../../../../lib/gate';
import { sealEvidence, checkAndBumpQuota } from '../../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable } from '../../../../../lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return out;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit('batch:' + ip, 30, 60_000).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS });
  }

  const body = await req.json().catch(() => ({}));
  const items: Array<{ id?: string; phone?: string }> = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: 'items_required', example: { items: [{ id: 'lead_1', phone: '+14155552671' }] } }, { status: 400, headers: CORS });
  }

  const acc = await authenticate(req);
  if (acc && !creditsAvailable(acc)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing', message: 'Credit balance is empty — upgrade at /pricing to run bulk scrubs.' }, { status: 402, headers: CORS });
  }
  const maxItems = acc ? 5000 : 200;
  if (items.length > maxItems) {
    return NextResponse.json({ error: 'batch_too_large', max: maxItems, hint: acc ? undefined : 'Sign up for an API key: POST /api/auth/signup' }, { status: 413, headers: CORS });
  }
  if (!acc) {
    const quota = await checkAndBumpQuota('ip:' + ip);
    if (!quota.allowed) return NextResponse.json({ error: 'quota_exceeded', used: quota.used, limit: quota.monthly_limit }, { status: 429, headers: CORS });
  }

  const started = Date.now();
  let creditsLeft: number | undefined;
  const results = await pool(items, 20, async (item) => {
    if (!item?.phone) return { id: item?.id, decision: 'skip', reason: 'no_phone' };
    try {
      const gate = await runPhoneGate({
        phone: item.phone, channel: body.channel === 'sms' ? 'sms' : 'voice',
        consent: body.consent, mode: body.mode,
      });
      const { evidence } = await sealEvidence({
        phone: item.phone, channel: body.channel === 'sms' ? 'sms' : 'voice',
        consent: body.consent ?? { declared: false, type: 'none' },
        decision: gate.decision, reason: gate.reason, checks: gate.checks, callerKey: acc?.email || 'ip:' + ip,
      });
      return {
        id: item.id ?? null,
        decision: gate.decision, reason: gate.reason,
        line_type: gate.checks.line_type, timezone: gate.checks.calling_hours.timezone ?? null,
        evidence_id: evidence.evidence_id,
      };
    } catch (e: any) {
      return { id: item?.id ?? null, decision: body.mode === 'fail_open' ? 'allow' : 'block', reason: 'gate_unavailable', degraded: true };
    }
  });

  if (acc) {
    const m = await meter(acc, results.length * 2);
    creditsLeft = m.creditsLeft;
  }

  const byReason: Record<string, number> = {};
  for (const r of results) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
  const allow = results.filter((r) => r.decision === 'allow').length;

  return NextResponse.json({
    batch_id: 'bt_' + Math.random().toString(36).slice(2, 10),
    summary: { total: results.length, allow, block: results.length - allow, by_reason: byReason },
    results,
    metered: acc ? { credits_used: results.length * 2, credits_left: creditsLeft } : { plan: 'FREE', free_tier_limit: 200 },
    latency_ms: Date.now() - started,
  }, { headers: CORS });
}
