export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dbEnabled, prisma } from '@/lib/db';
import { disableOrganization } from '@/lib/orgs';

export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  if (process.env.NODE_ENV === 'production' || process.env.VERIFYONE_TEST_HOOKS !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const existing = await prisma.organization.findFirst({
    where: { OR: [{ clerkOrgId: params.id }, { id: params.id }] },
    select: { clerkOrgId: true },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const org = await disableOrganization(existing.clerkOrgId);
  return NextResponse.json({ ok: true, id: org?.id, clerkOrgId: existing.clerkOrgId });
}
