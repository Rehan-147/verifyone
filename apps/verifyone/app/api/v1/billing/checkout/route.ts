export const dynamic = 'force-dynamic';

// POST /api/v1/billing/checkout { plan, email? } → { checkout_url }
// For organization API keys. The paying organization is the key's organization; the
// webhook credits exactly that organization (metadata.org_id). email defaults to the
// organization's billing email.
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, hasKeyHeader, rateLimit } from '@/lib/auth';
import { dbEnabled, prisma } from '@/lib/db';
import { persistenceUnavailableResponse } from '@/lib/persistence-response';
import { startOrgCheckout } from '@/lib/billing-checkout';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let acc;
  try { acc = await authenticate(req); } catch { return persistenceUnavailableResponse(); }
  if (!acc) return NextResponse.json({ error: hasKeyHeader(req) ? 'invalid_api_key' : 'api_key_required' }, { status: 401 });
  if (!acc.orgId || !dbEnabled()) {
    return NextResponse.json({ error: 'org_account_required', message: 'Subscriptions are for organization accounts (sign up in the dashboard).' }, { status: 400 });
  }
  if (!rateLimit('checkout:org:' + acc.orgId, 10, 60_000).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const org = await prisma.organization.findUnique({ where: { id: acc.orgId } });
  if (!org) return NextResponse.json({ error: 'org_account_required' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; email?: unknown };
  return startOrgCheckout({
    org,
    plan: body.plan,
    email: org.billingEmail ?? (typeof body.email === 'string' ? body.email : null),
    appUrl: process.env.APP_URL || req.nextUrl.origin,
  });
}
