export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkConfigured } from '@/lib/clerk';
import { dbEnabled } from '@/lib/db';
import { createOrgApiKey, getOrCreateOrganization, listOrgApiKeys } from '@/lib/orgs';

export const runtime = 'nodejs';

export async function GET() {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const { userId, orgId, orgSlug } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  const keys = await listOrgApiKeys(org.id);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });
  if (orgRole !== 'org:admin') return NextResponse.json({ error: 'admin_required' }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  const created = await createOrgApiKey(org.id, name, userId);
  return NextResponse.json({ key: created.key, record: created.record }, { status: 201 });
}
