export const dynamic = 'force-dynamic';

// DEV/TEST ONLY — 404 in production or unless VERIFYONE_TEST_HOOKS=1.
// POST { action: 'backdate', phone, hours } → shift the caller's attempts for a number into the past
// so tests can check the rolling 24-hour window without waiting a day.
import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { ownerKeyFor } from '@/lib/platform-credentials';
import { backdateAttemptsForTest } from '@/lib/frequency';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.VERIFYONE_TEST_HOOKS !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const acc = await authenticate(req);
  if (!acc) return NextResponse.json({ error: 'api_key_required' }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (body.action !== 'backdate') return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  const phone = typeof body.phone === 'string' ? body.phone : '';
  const hours = typeof body.hours === 'number' && body.hours > 0 && body.hours <= 24 * 30 ? body.hours : 0;
  if (!phone || !hours) return NextResponse.json({ error: 'phone_and_hours_required' }, { status: 400 });

  const changed = await backdateAttemptsForTest(ownerKeyFor(acc), phone, hours);
  return NextResponse.json({ ok: true, changed });
}
