export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dbEnabled, prisma } from '@/lib/db';
import { getOrCreateOrganization } from '@/lib/orgs';

export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  if (process.env.NODE_ENV === 'production' || process.env.VERIFYONE_TEST_HOOKS !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const existing = await prisma.organization.findFirst({
    where: { OR: [{ clerkOrgId: params.id }, { id: params.id }] },
    select: { clerkOrgId: true },
  });
  const clerkOrgId = existing?.clerkOrgId || params.id;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'New Name';

  const org = await getOrCreateOrganization(clerkOrgId, name);
  return NextResponse.json({
    ok: true,
    org: { id: org.id, clerkOrgId: org.clerkOrgId, name: org.name, disabledAt: org.disabledAt },
  });
}
