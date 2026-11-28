// Organization checkout: one place that decides whether an org may start a Dodo checkout,
// so the dashboard route and the API-key route behave identically.
import { NextResponse } from 'next/server';
import { createCheckoutSession, dodoConfigured } from './dodo';
import { PLANS, normalizePlanKey } from './plans';
import { prisma } from './db';

type OrgRow = { id: string; plan: string; disabledAt: Date | null; dodoSubscriptionId: string | null; billingEmail: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function startOrgCheckout(opts: { org: OrgRow; plan: unknown; email: string | null | undefined; appUrl: string }) {
  const { org } = opts;
  if (org.disabledAt) return NextResponse.json({ error: 'org_disabled' }, { status: 403 });
  const plan = normalizePlanKey(String(opts.plan ?? ''));
  if (!plan) return NextResponse.json({ error: 'invalid_plan', valid: Object.keys(PLANS) }, { status: 400 });
  const email = String(opts.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'valid_email_required' }, { status: 400 });

  // One paying subscription per organization: a second checkout would bill twice.
  if (org.dodoSubscriptionId && org.plan !== 'FREE') {
    return NextResponse.json({
      error: 'subscription_exists',
      plan: org.plan,
      message: 'This organization already has an active subscription. To change plan, cancel it from the link in your Dodo receipt email, then subscribe again, or contact support.',
    }, { status: 409 });
  }

  if (!dodoConfigured()) {
    return NextResponse.json({ error: 'payments_not_configured', message: 'Payments are not configured in this environment.' }, { status: 503 });
  }

  try {
    const session = await createCheckoutSession({
      email,
      plan,
      orgId: org.id,
      returnUrl: `${opts.appUrl.replace(/\/$/, '')}/dashboard/billing?upgraded=1`,
    });
    if (!org.billingEmail) {
      await prisma.organization.update({ where: { id: org.id }, data: { billingEmail: email } }).catch(() => undefined);
    }
    return NextResponse.json({ checkout_url: session.checkout_url, session_id: session.session_id, plan });
  } catch (e) {
    console.error('[billing] checkout failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
  }
}
