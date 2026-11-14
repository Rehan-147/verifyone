export const dynamic = 'force-dynamic';

// ACCOUNT USAGE — the "no surprises" endpoint (cost predictability contract).
// GET /api/v1/account/usage
//   -> plan, exact live credit balance, meters, and the honest zero-balance behavior.
// The balance is the same number the dashboard shows and the same one the meters
// decrement; nothing the customer is charged for is hidden from this view.
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, creditsAvailable, rateLimit, hasKeyHeader, clientIp } from '@/lib/auth';
import { PLANS } from '@/lib/plans';
import { GATE_BUNDLES, ADDON_CREDITS, CREDIT_COSTS } from '@/lib/credits';

export async function GET(req: NextRequest) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401 });
  }

  const rl = rateLimit('usage:' + clientIp(req), 120);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });
  }

  if (!acc) {
    return NextResponse.json(
      {
        error: 'api_key_required',
        signup: '/api/auth/signup',
        free_tier: {
          monthly_limit: 500,
          note: 'Anonymous usage is metered per identity against this free tier, both covered by the same trial credits.',
        },
      },
      { status: 401 },
    );
  }

  // FREE is not a plan in PLANS — its account starts with 1,000 trial credits.
  const planDef = (PLANS as Record<string, { priceUsd: number; credits: number; name: string }>)[acc.plan];
  const initialGrant = planDef?.credits ?? 1000;
  const remaining = Math.max(0, acc.credits); // exact balance (meters decrement it)
  const usedEstimate = Math.max(0, initialGrant - remaining);

  return NextResponse.json(
    {
      plan: acc.plan,
      plan_pricing: planDef ? { name: planDef.name, price_usd_month: planDef.priceUsd, credits_per_month: planDef.credits } : undefined,
      billing_model:
        'flat monthly plan + one universal credit balance — no per-call surcharges, no overage billing',
      credits: {
        remaining,
        initial_grant_this_plan: initialGrant,
        used_estimate: usedEstimate,
        used_estimate_note:
          'used_estimate = initial grant − remaining. Plan renewals and manual credit additions make this an estimate; the remaining balance is exact.',
      },
      meters: {
        gate_bundles: GATE_BUNDLES,
        metered_addons: ADDON_CREDITS,
        standalone_checks: CREDIT_COSTS,
      },
      rate_limit: '120 req/min per key',
      zero_balance_behavior: {
        verdict: 'fail closed',
        api_endpoints: 'metered endpoints return 402 insufficient_credits',
        voice_webhooks: 'Vapi/Retell inbound screening uses 1 credit, rejects invalid numbers, flags loaded litigator matches, and skips outbound DNC/consent rules; per-account block-list lookup is not wired. Outbound gate-then-dial workflows must not create a call unless the REST gate returns ALLOW.',
        reup: '/pricing (or POST /api/billing/checkout)',
      },
      balance_ok: creditsAvailable(acc, 1),
      account: {
        email_masked: acc.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        created_at: acc.createdAt,
        last_used_at: acc.lastUsedAt ?? null,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
