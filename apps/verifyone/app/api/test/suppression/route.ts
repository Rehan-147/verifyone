export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { dbEnabled, prisma } from '@/lib/db';
import { normalizePhone, sha256 } from '@/lib/audit-store';
import { ownerKeyFor, setForceEncryptFailureForTest } from '@/lib/platform-credentials';
import { exportSuppressionCsv } from '@/lib/suppression';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.VERIFYONE_TEST_HOOKS !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'force_encrypt_error') {
    setForceEncryptFailureForTest(body.value === true);
    return NextResponse.json({ ok: true, value: body.value === true });
  }

  if (action === 'clear_add_evidence') {
    if (!dbEnabled()) return NextResponse.json({ error: 'db_required' }, { status: 400 });
    const acc = await authenticate(req);
    if (!acc) return NextResponse.json({ error: 'api_key_required' }, { status: 401 });
    const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : '';
    if (!/^\+\d{7,15}$/.test(phone)) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    const updated = await prisma.suppressionEntry.updateMany({
      where: { ownerKey: ownerKeyFor(acc), phoneHash: sha256(phone), removedAt: null },
      data: { addEvidenceId: null },
    });
    return NextResponse.json({ ok: true, count: updated.count });
  }

  if (action === 'export_csv') {
    const acc = await authenticate(req);
    if (!acc) return NextResponse.json({ error: 'api_key_required' }, { status: 401 });
    const csv = await exportSuppressionCsv(ownerKeyFor(acc));
    return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
