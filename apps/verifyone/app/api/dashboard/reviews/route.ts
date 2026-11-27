export const dynamic = 'force-dynamic';

// Dashboard review queue API — Clerk-authenticated, org-scoped.
// GET  /api/dashboard/reviews?status=open&cursor=
// POST /api/dashboard/reviews/:id/approve  { note }
// POST /api/dashboard/reviews/:id/reject   { note }
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateOrganization } from '../../../../lib/orgs';
import { listReviews, reviewStats, toMaskedItem } from '../../../../lib/reviews';

export async function GET(req: NextRequest) {
  const { userId, orgId, orgSlug } = auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  const ownerKey = `org:${org.id}`;

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') as 'open' | 'approved' | 'rejected' | 'expired' | null;
  const cursor = sp.get('cursor');

  const [list, stats] = await Promise.all([
    listReviews({ ownerKey, status, cursor, limit: 50 }),
    reviewStats(ownerKey),
  ]);

  return NextResponse.json({
    items: list.items.map(toMaskedItem),
    next_cursor: list.next_cursor,
    stats,
  });
}
