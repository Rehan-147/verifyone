export const dynamic = 'force-dynamic';

// POST /api/billing/checkout { email, plan: STARTER|GROWTH|PRO }
// -> { checkout_url } (Dodo Payments, merchant of record)
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, dodoConfigured } from '../../../../lib/dodo';
import { PLANS, normalizePlanKey, type PlanName } from '../../../../lib/plans';
import { rateLimit, clientIp } from '../../../../lib/auth';

export async function POST(req: NextRequest) {
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
      message: 'Set DODO_PAYMENTS_API_KEY (and DODO_PRODUCT_*) in .env — see .env.example. Meanwhile, email us for a manual invoice.',
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
  } catch (e: any) {
    return NextResponse.json({ error: 'checkout_failed', detail: String(e?.message || e) }, { status: 502 });
  }
}
