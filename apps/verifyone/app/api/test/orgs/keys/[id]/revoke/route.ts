export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dbEnabled } from '@/lib/db';
import { revokeOrgApiKey } from '@/lib/orgs';

export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  if (process.env.NODE_ENV === 'production' || process.env.VERIFYONE_TEST_HOOKS !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  if (!orgId) return NextResponse.json({ error: 'orgId_required' }, { status: 400 });

  const ok = await revokeOrgApiKey(orgId, params.id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: params.id });
}
