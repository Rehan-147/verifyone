export const dynamic = 'force-dynamic';

// GET  /api/v1/settings/frequency  → the account's call-frequency settings
// PUT  /api/v1/settings/frequency  { call_cap_24h: number | null }
//
// call_cap_24h limits how many call attempts this account may make to the SAME number in a
// rolling 24 hours (1–50, or null for no account cap). State rules such as Florida's
// 3 calls / 24 h always apply on top; the stricter limit wins and a state rule cannot be raised.
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, hasKeyHeader, rateLimit } from '@/lib/auth';
import { dbEnabled } from '@/lib/db';
import { getOrgCallCap, setOrgCallCap } from '@/lib/frequency';
import { ORG_CALL_CAP_MAX, ORG_CALL_CAP_MIN, STATE_FREQUENCY_RULES } from '@/lib/data/state-frequency-rules';
import { persistenceUnavailableResponse } from '@/lib/persistence-response';

export const runtime = 'nodejs';

function stateRules() {
  return Object.entries(STATE_FREQUENCY_RULES).map(([state, rule]) => ({
    state,
    max_calls: rule.maxCalls,
    window_hours: rule.windowHours,
    citation: rule.citation,
    needs_counsel_review: rule.needs_counsel_review,
  }));
}

async function requireOrgAccount(req: NextRequest) {
  let acc;
  try { acc = await authenticate(req); } catch { return { error: persistenceUnavailableResponse() }; }
  if (!acc) {
    return { error: NextResponse.json({ error: hasKeyHeader(req) ? 'invalid_api_key' : 'api_key_required' }, { status: 401 }) };
  }
  if (!acc.orgId || !dbEnabled()) {
    return {
      error: NextResponse.json(
        { error: 'org_account_required', message: 'Account-wide call caps are available for organization accounts (sign up in the dashboard).' },
        { status: 400 },
      ),
    };
  }
  return { acc, orgId: acc.orgId };
}

export async function GET(req: NextRequest) {
  const ctx = await requireOrgAccount(req);
  if ('error' in ctx) return ctx.error;
  const rl = rateLimit('settings:get:' + ctx.orgId, 120);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });
  try {
    const cap = await getOrgCallCap(`org:${ctx.orgId}`);
    return NextResponse.json({ call_cap_24h: cap, allowed_range: [ORG_CALL_CAP_MIN, ORG_CALL_CAP_MAX], state_rules: stateRules() });
  } catch {
    return persistenceUnavailableResponse();
  }
}

export async function PUT(req: NextRequest) {
  const ctx = await requireOrgAccount(req);
  if ('error' in ctx) return ctx.error;
  const rl = rateLimit('settings:put:' + ctx.orgId, 30);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => null) as { call_cap_24h?: unknown } | null;
  if (!body || !('call_cap_24h' in body)) {
    return NextResponse.json({ error: 'call_cap_24h_required', message: 'Send { "call_cap_24h": 3 } or { "call_cap_24h": null }.' }, { status: 400 });
  }
  const raw = body.call_cap_24h;
  const valid = raw === null || (typeof raw === 'number' && Number.isInteger(raw) && raw >= ORG_CALL_CAP_MIN && raw <= ORG_CALL_CAP_MAX);
  if (!valid) {
    return NextResponse.json(
      { error: 'invalid_call_cap', message: `call_cap_24h must be an integer from ${ORG_CALL_CAP_MIN} to ${ORG_CALL_CAP_MAX}, or null.` },
      { status: 400 },
    );
  }
  try {
    const cap = await setOrgCallCap(ctx.orgId, raw as number | null);
    return NextResponse.json({ call_cap_24h: cap, state_rules: stateRules() });
  } catch {
    return persistenceUnavailableResponse();
  }
}
