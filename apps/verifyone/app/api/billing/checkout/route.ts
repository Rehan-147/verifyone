export const dynamic = 'force-dynamic';

// POST /api/billing/checkout { email, plan } -> { checkout_url }
// LEGACY email-only checkout for pre-organization accounts (local development without Clerk).
// When Clerk is configured, subscriptions belong to organizations: use the dashboard
// (/dashboard/billing) or POST /api/v1/billing/checkout with an organization API key, so the
// webhook can credit the paying organization exactly.
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, dodoConfigured } from '../../../../lib/dodo';
import { PLANS, normalizePlanKey } from '../../../../lib/plans';
import { rateLimit, clientIp } from '../../../../lib/auth';
import { clerkConfigured } from '../../../../lib/clerk';

export async function POST(req: NextRequest) {
  if (clerkConfigured()) {
    return NextResponse.json({
      error: 'use_organization_checkout',
      message: 'Subscribe from your organization billing page, or call POST /api/v1/billing/checkout with an organization API key.',
      billing_page: '/dashboard/billing',
    }, { status: 410 });
  }

  const ip = clientIp(req);
  if (!rateLimit('checkout:' + ip, 10, 60_000).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { email, plan } = await req.json().catch(() => ({ email: '', plan: '' }));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'valid_email_required' }, { status: 400 });
  }
  const planName = normalizePlanKey(String(plan || ''));
  if (!planName) {
    return NextResponse.json({ error: 'invalid_plan', valid: Object.keys(PLANS) }, { status: 400 });
  }

  if (!dodoConfigured()) {
    return NextResponse.json({
      error: 'payments_not_configured',
      message: 'Set DODO_PAYMENTS_API_KEY (and DODO_PRODUCT_*) in .env — see .env.example.',
    }, { status: 503 });
  }

  try {
    const appUrl = process.env.APP_URL || req.nextUrl.origin;
    const session = await createCheckoutSession({
      email,
      plan: planName,
      returnUrl: `${appUrl}/dashboard?upgraded=1`,
    });
    return NextResponse.json({ checkout_url: session.checkout_url, session_id: session.session_id, plan: planName });
  } catch (e) {
    console.error('[billing] legacy checkout failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
  }
}
