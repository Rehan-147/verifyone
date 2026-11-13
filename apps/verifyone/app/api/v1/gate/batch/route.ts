// POST /api/v1/gate/batch — LIST PRE-FLIGHT: scrub a whole campaign list before it runs.
// Zero per-call latency for the agent: one batch call upstream, agent dials a pre-cleaned list.
// Body: { items: [{id?, phone}, ...], consent?, channel?, mode? }
// Keyless: max 200 items (free tier). Keyed: max 5,000. Concurrency-limited upstream.
import { NextRequest, NextResponse } from 'next/server';
import { runPhoneGate } from '../../../../../lib/gate';
import { sealEvidence, checkAndBumpQuota } from '../../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../../lib/auth';
import { gateBundleCredits, resolveGateProfile } from '../../../../../lib/credits';
import { persistenceUnavailableResponse } from '../../../../../lib/persistence-response';

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
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401, headers: CORS });
  }

  const ip = clientIp(req);
  if (!rateLimit('batch:' + ip, 30, 60_000).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS });
  }

  const body = await req.json().catch(() => ({}));
  const items: Array<{ id?: string; phone?: string }> = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: 'items_required', example: { items: [{ id: 'lead_1', phone: '+14155552671' }] } }, { status: 400, headers: CORS });
  }

  const profile = resolveGateProfile(body);
  const consent = body.consent ?? { declared: false, type: 'none' };
  const perItemCost = gateBundleCredits(profile, { trustedform: typeof consent.trustedform_cert_url === 'string' });
  if (acc && !creditsAvailable(acc, items.length * perItemCost)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing', message: 'Credit balance is insufficient for this batch.' }, { status: 402, headers: CORS });
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
        consent, mode: body.mode, profile,
      });
      const { evidence } = await sealEvidence({
        phone: item.phone, channel: body.channel === 'sms' ? 'sms' : 'voice',
        consent,
        decision: gate.decision, reason: gate.reason, checks: gate.checks, callerKey: acc?.email || 'ip:' + ip,
      });
      return {
        id: item.id ?? null,
        decision: gate.decision, reason: gate.reason,
        line_type: gate.checks.line_type, timezone: gate.checks.calling_hours.timezone ?? null,
        evidence_id: evidence.evidence_id,
      };
    } catch (e: any) {
      if (e?.message === 'persistence_unavailable') return { id: item?.id ?? null, decision: 'block', reason: 'persistence_unavailable' };
      return { id: item?.id ?? null, decision: body.mode === 'fail_open' ? 'allow' : 'block', reason: 'gate_unavailable', degraded: true };
    }
  });

  if (results.some((r: any) => r.reason === 'persistence_unavailable')) return persistenceUnavailableResponse(CORS);

  const billableCount = results.filter((r: any) =>
    typeof r.evidence_id === 'string' && r.reason !== 'gate_unavailable_fail_closed' && r.reason !== 'fail_open_gate_unavailable' && r.reason !== 'gate_unavailable',
  ).length;
  if (acc && billableCount) {
    const m = await meter(acc, billableCount * perItemCost, `/api/v1/gate/batch:${profile}`);
    creditsLeft = m.creditsLeft;
    if (m.race) console.warn('[billing] credit debit race after batch decisions', { email: acc.email, cost: billableCount * perItemCost });
  }

  const byReason: Record<string, number> = {};
  for (const r of results) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
  const allow = results.filter((r) => r.decision === 'allow').length;

  return NextResponse.json({
    batch_id: 'bt_' + Math.random().toString(36).slice(2, 10),
    summary: { total: results.length, allow, block: results.length - allow, by_reason: byReason },
    results,
    metered: acc ? { credits_used: billableCount * perItemCost, credits_left: creditsLeft } : { plan: 'FREE', free_tier_limit: 200 },
    latency_ms: Date.now() - started,
  }, { headers: CORS });
}
