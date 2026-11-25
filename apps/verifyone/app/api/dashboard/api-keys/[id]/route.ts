export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkConfigured } from '@/lib/clerk';
import { dbEnabled } from '@/lib/db';
import { getOrCreateOrganization, revokeOrgApiKey } from '@/lib/orgs';

export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });
  if (orgRole !== 'org:admin') return NextResponse.json({ error: 'admin_required' }, { status: 403 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  const revoked = await revokeOrgApiKey(org.id, params.id);
  if (!revoked) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: params.id });
}
