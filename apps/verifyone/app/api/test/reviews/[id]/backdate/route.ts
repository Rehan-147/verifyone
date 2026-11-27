export const dynamic = 'force-dynamic';
// DEV-ONLY test hook: backdate expiresAt (and approvalExpiresAt for approved items) into the past.
// Guards: NODE_ENV !== 'production' AND VERIFYONE_TEST_HOOKS === '1', else 404.
// POST /api/test/reviews/:id/backdate
import { NextRequest, NextResponse } from 'next/server';
import { dbEnabled, prisma } from '../../../../../../lib/db';
import path from 'path';
import fs from 'fs/promises';

function guardTestHook() {
  if (process.env.VERIFYONE_TEST_HOOKS !== '1' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = guardTestHook();
  if (guard) return guard;

  const id = params.id;
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  // Backdate to 1 second in the past
  const newExpiry = new Date(Date.now() - 1000);

  if (dbEnabled()) {
    const item = await prisma.reviewItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const data: { expiresAt: Date; approvalExpiresAt?: Date } = { expiresAt: newExpiry };
    // Also backdate approvalExpiresAt for approved items so the approval-id path sees it as expired
    if (item.status === 'approved') {
      data.approvalExpiresAt = newExpiry;
    }
    await prisma.reviewItem.update({ where: { id }, data });
    return NextResponse.json({ ok: true, id, expiresAt: newExpiry.toISOString(), approvalExpiresAt: item.status === 'approved' ? newExpiry.toISOString() : undefined });
  }

  // File mode
  const fp = path.join(process.cwd(), '.data', 'reviews.json');
  try {
    const rows: Array<Record<string, unknown>> = JSON.parse(await fs.readFile(fp, 'utf8'));
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const item = rows[idx];
    rows[idx] = { ...item, expiresAt: newExpiry.toISOString() };
    // Also backdate approvalExpiresAt for approved items
    if (item.status === 'approved') {
      rows[idx].approvalExpiresAt = newExpiry.toISOString();
    }
    await fs.writeFile(fp, JSON.stringify(rows, null, 2));
    return NextResponse.json({
      ok: true, id, expiresAt: newExpiry.toISOString(),
      ...(item.status === 'approved' ? { approvalExpiresAt: newExpiry.toISOString() } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: 'file_read_failed', detail: String(err) }, { status: 500 });
  }
}
