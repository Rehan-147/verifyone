export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateOrganization } from '../../../../../../lib/orgs';
import { reject, toMaskedItem } from '../../../../../../lib/reviews';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  if (orgRole !== 'org:admin') return NextResponse.json({ error: 'admin_required', message: 'Only org admins can reject review items.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { note } = body as { note?: string };
  if (!note?.trim()) return NextResponse.json({ error: 'note_required', message: 'A non-empty note is required.' }, { status: 400 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  const ownerKey = `org:${org.id}`;

  try {
    const item = await reject({ id: params.id, ownerKey, resolvedBy: `clerk:${userId}`, note: note! });
    return NextResponse.json({ item: toMaskedItem(item) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'note_required') return NextResponse.json({ error: 'note_required' }, { status: 400 });
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (msg === 'item_expired') return NextResponse.json({ error: 'item_expired', message: 'This review item has expired.' }, { status: 409 });
    if (msg.startsWith('item_already_')) return NextResponse.json({ error: msg }, { status: 409 });
    throw err;
  }
}
