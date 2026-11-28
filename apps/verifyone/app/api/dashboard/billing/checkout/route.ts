export const dynamic = 'force-dynamic';

// POST /api/dashboard/billing/checkout { plan } → { checkout_url }
// Clerk session, organization admins only. The organization and the billing email come from
// the session, never from the request body.
import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { clerkConfigured } from '@/lib/clerk';
import { dbEnabled } from '@/lib/db';
import { getOrCreateOrganization } from '@/lib/orgs';
import { rateLimit } from '@/lib/auth';
import { startOrgCheckout } from '@/lib/billing-checkout';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });
  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });
  if (orgRole !== 'org:admin') return NextResponse.json({ error: 'admin_required' }, { status: 403 });
  if (!rateLimit('checkout:org:' + orgId, 10, 60_000).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  const user = await currentUser();
  return startOrgCheckout({
    org,
    plan: body.plan,
    email: org.billingEmail ?? user?.primaryEmailAddress?.emailAddress,
    appUrl: process.env.APP_URL || req.nextUrl.origin,
  });
}
