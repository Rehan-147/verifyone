export const dynamic = 'force-dynamic';
// DEV-ONLY test hooks for review queue tests.
// Guards: VERIFYONE_TEST_HOOKS=1 and NODE_ENV !== 'production'.
import { NextRequest, NextResponse } from 'next/server';
import { dbEnabled, prisma } from '../../../../lib/db';
import path from 'path';
import fs from 'fs/promises';

function guardTestHook(req: NextRequest) {
  if (process.env.VERIFYONE_TEST_HOOKS !== '1' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'test_hooks_disabled' }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const guard = guardTestHook(req);
  if (guard) return guard;

  const body = await req.json().catch(() => ({}));
  const { action, id, expiresAt } = body as { action?: string; id?: string; expiresAt?: string };

  // Backdate expiresAt to simulate expired items
  if (action === 'backdate_expires') {
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const newExpiry = expiresAt ? new Date(expiresAt) : new Date(Date.now() - 1000);
    if (dbEnabled()) {
      await prisma.reviewItem.update({ where: { id }, data: { expiresAt: newExpiry } });
      return NextResponse.json({ ok: true, id, expiresAt: newExpiry.toISOString() });
    }
    // File mode
    const fp = path.join(process.cwd(), '.data', 'reviews.json');
    try {
      const rows = JSON.parse(await fs.readFile(fp, 'utf8'));
      const idx = rows.findIndex((r: { id: string }) => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      rows[idx].expiresAt = newExpiry.toISOString();
      await fs.writeFile(fp, JSON.stringify(rows, null, 2));
      return NextResponse.json({ ok: true, id, expiresAt: newExpiry.toISOString() });
    } catch {
      return NextResponse.json({ error: 'file_read_failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
