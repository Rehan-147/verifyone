export const dynamic = 'force-dynamic';

// POST /api/scan — free public list scan (no account).
// Body: text/csv, or multipart/form-data with field "file". Optional ?debug_now= (dev only).
// Returns aggregate counts only; phone numbers are never stored or returned.
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/auth';
import { runPublicScan, ScanError } from '@/lib/scan';

export const runtime = 'nodejs';

const MAX_BYTES = 1_000_000; // ~1,000 rows with several columns

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit('scan:' + ip, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const declared = Number(req.headers.get('content-length') || '0');
  if (declared > MAX_BYTES) return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_BYTES }, { status: 413 });

  let text = '';
  const type = req.headers.get('content-type') || '';
  try {
    if (type.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') return NextResponse.json({ error: 'file_required' }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_BYTES }, { status: 413 });
      text = await file.text();
    } else {
      text = await req.text();
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_BYTES }, { status: 413 });

  try {
    const result = await runPublicScan(text, ip, { debugNow: req.nextUrl.searchParams.get('debug_now') || undefined });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ScanError) return NextResponse.json({ error: error.code, ...(error.detail ?? {}) }, { status: error.status });
    console.error('[scan] failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'scan_unavailable' }, { status: 503 });
  }
}
