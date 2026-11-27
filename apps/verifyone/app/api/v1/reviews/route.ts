export const dynamic = 'force-dynamic';

// GET  /api/v1/reviews?status=open&cursor=&reason=
// POST /api/v1/reviews/dispute { evidence_id, note }
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, hasKeyHeader } from '../../../../lib/auth';
import { ownerKeyFor } from '../../../../lib/platform-credentials';
import { listReviews, openDispute, toMaskedItem, DISPUTEABLE_DENY_REASONS, notOverridableMessage } from '../../../../lib/reviews';
import { getEvidence } from '../../../../lib/audit-store';
import { toPublicReason } from '../../../../lib/gate-contract';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const acc = await authenticate(req);
  if (!acc) return NextResponse.json({ error: 'authentication_required' }, { status: 401, headers: CORS });

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') as 'open' | 'approved' | 'rejected' | 'expired' | null;
  const reason = sp.get('reason');
  const cursor = sp.get('cursor');
  const ownerKey = ownerKeyFor(acc);

  const result = await listReviews({ ownerKey, status, reason, cursor, limit: 50 });
  return NextResponse.json({ items: result.items.map(toMaskedItem), next_cursor: result.next_cursor }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) return NextResponse.json({ error: 'invalid_api_key' }, { status: 401, headers: CORS });
  if (!acc) return NextResponse.json({ error: 'authentication_required' }, { status: 401, headers: CORS });

  const body = await req.json().catch(() => ({}));
  const { evidence_id, note } = body as { evidence_id?: string; note?: string };
  if (!evidence_id) return NextResponse.json({ error: 'evidence_id_required' }, { status: 400, headers: CORS });
  if (!note?.trim()) return NextResponse.json({ error: 'note_required', message: 'A non-empty note is required.' }, { status: 400, headers: CORS });

  const ownerKey = ownerKeyFor(acc);

  let ev: Record<string, unknown> | null = null;
  try { ev = await getEvidence(evidence_id); } catch { /* not found */ }
  if (!ev) return NextResponse.json({ error: 'evidence_not_found' }, { status: 404, headers: CORS });

  const reason = String(ev.reason ?? '');
  if (!DISPUTEABLE_DENY_REASONS.has(reason)) {
    return NextResponse.json({ error: 'not_overridable', reason, message: notOverridableMessage(reason) }, { status: 400, headers: CORS });
  }

  // phone_hash from the evidence record avoids normalizing a masked phone
  // (the masked value contains '*' chars that corrupt normalization).
  const phoneMasked = String(ev.phone_masked ?? (ev.request as Record<string, unknown> | undefined)?.phone_masked ?? '');
  const phoneHashOverride = typeof (ev.request as Record<string, unknown> | undefined)?.phone_hash === 'string'
    ? String((ev.request as Record<string, unknown>).phone_hash)
    : undefined;

  try {
    const item = await openDispute({
      ownerKey, gateEvidenceId: evidence_id, phone: phoneMasked,
      reason, publicReason: toPublicReason(reason, {} as never), note: note!,
      phoneHashOverride,
    });
    return NextResponse.json({ item: toMaskedItem(item) }, { status: 201, headers: CORS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'not_overridable') return NextResponse.json({ error: 'not_overridable', message: notOverridableMessage(reason) }, { status: 400, headers: CORS });
    throw err;
  }
}
