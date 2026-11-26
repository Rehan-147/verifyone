export const dynamic = 'force-dynamic';

// POST /api/v1/reviews/:id/approve { note }
import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '../../../../../../lib/auth';
import { ownerKeyFor } from '../../../../../../lib/platform-credentials';
import { approve, toMaskedItem } from '../../../../../../lib/reviews';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const acc = await authenticate(req);
  if (!acc) return NextResponse.json({ error: 'authentication_required' }, { status: 401, headers: CORS });

  const body = await req.json().catch(() => ({}));
  const { note } = body as { note?: string };
  if (!note?.trim()) return NextResponse.json({ error: 'note_required', message: 'A non-empty note is required.' }, { status: 400, headers: CORS });

  const ownerKey = ownerKeyFor(acc);
  try {
    const item = await approve({ id: params.id, ownerKey, resolvedBy: ownerKey, note: note! });
    return NextResponse.json({ item: toMaskedItem(item) }, { headers: CORS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'note_required') return NextResponse.json({ error: 'note_required' }, { status: 400, headers: CORS });
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404, headers: CORS });
    if (msg === 'item_expired') return NextResponse.json({ error: 'item_expired', message: 'This review item has expired and can no longer be approved.' }, { status: 409, headers: CORS });
    if (msg.startsWith('item_already_')) return NextResponse.json({ error: msg }, { status: 409, headers: CORS });
    throw err;
  }
}
