export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkConfigured } from '@/lib/clerk';
import { dbEnabled } from '@/lib/db';
import { getOrCreateOrganization } from '@/lib/orgs';
import { exportSuppressionCsv } from '@/lib/suppression';

export const runtime = 'nodejs';

export async function GET() {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });
  if (orgRole !== 'org:admin') return NextResponse.json({ error: 'admin_required' }, { status: 403 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  if (org.disabledAt) return NextResponse.json({ error: 'org_disabled' }, { status: 403 });

  const csv = await exportSuppressionCsv(`org:${org.id}`);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="verifyone-suppression-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
