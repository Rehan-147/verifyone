import { NextRequest, NextResponse } from 'next/server';
import { authenticate, creditsAvailable, rateLimit } from '@/lib/auth';
import { ownerKeyFor } from '@/lib/platform-credentials';
import { gateBundleCredits, resolveGateProfile } from '@/lib/credits';
import { normalizePhone } from '@/lib/audit-store';
import { createBulkJob, type NewBulkRow } from '@/lib/bulk-store';
import { findColumn, parseCsvInput, parseJsonRows } from '@/lib/bulk-input';
import { processBulkChunk } from '@/lib/bulk-worker';

export const runtime = 'nodejs';
const PHONE_COLUMNS = ['phone', 'phone_number', 'mobile', 'number', 'to', 'to_number', 'cell'];
const CONSENT_COLUMNS = ['consent_type', 'consent'];
const E164 = /^\+[1-9]\d{6,14}$/;

function maxRows() {
  const parsed = Number.parseInt(process.env.BULK_MAX_ROWS || '10000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
}
function retentionDays() {
  const parsed = Number.parseInt(process.env.BULK_RETENTION_DAYS || '30', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export async function POST(req: NextRequest) {
  let account;
  try { account = await authenticate(req); }
  catch { return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 }); }
  if (!account) return NextResponse.json({ error: 'api_key_required' }, { status: 401 });
  const rl = rateLimit(`bulk-create:${account.email.toLowerCase()}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const contentType = req.headers.get('content-type')?.toLowerCase() || '';
  let parsed;
  let requestedProfile: unknown;
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string' || typeof file.text !== 'function') return NextResponse.json({ error: 'file_required' }, { status: 400 });
      parsed = parseCsvInput(await file.text());
      requestedProfile = form.get('profile') || undefined;
    } else if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
      parsed = parseCsvInput(await req.text());
    } else {
      const body = await req.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) return NextResponse.json({ error: 'invalid_request_body' }, { status: 400 });
      parsed = parseJsonRows(body.rows);
      requestedProfile = body.profile;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'rows_array_required' ? message : 'invalid_csv' }, { status: 400 });
  }

  if (parsed.records.length > maxRows()) return NextResponse.json({ error: 'too_many_rows', max_rows: maxRows() }, { status: 413 });
  if (!parsed.records.length) return NextResponse.json({ error: 'rows_required' }, { status: 400 });
  const phoneColumn = findColumn(parsed.headers, PHONE_COLUMNS);
  if (!phoneColumn) return NextResponse.json({ error: 'phone_column_not_found', headers: parsed.headers }, { status: 400 });
  const consentColumn = findColumn(parsed.headers, CONSENT_COLUMNS);
  const profile = resolveGateProfile({ profile: typeof requestedProfile === 'string' ? requestedProfile : undefined });
  const seen = new Set<string>();
  const rows: NewBulkRow[] = [];
  let uniqueRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  parsed.records.forEach((original, rowIndex) => {
    const rawPhone = String(original[phoneColumn] ?? '');
    const normalized = normalizePhone(rawPhone);
    if (!E164.test(normalized)) {
      invalidRows += 1;
      rows.push({ rowIndex: rowIndex + 1, original, phone: null, status: 'invalid', reason: 'invalid_number' });
      return;
    }
    if (seen.has(normalized)) {
      duplicateRows += 1;
      rows.push({ rowIndex: rowIndex + 1, original, phone: normalized, status: 'duplicate', reason: 'duplicate_number' });
      return;
    }
    seen.add(normalized);
    uniqueRows += 1;
    rows.push({ rowIndex: rowIndex + 1, original, phone: normalized, status: 'pending' });
  });

  const requiredCredits = uniqueRows * gateBundleCredits(profile);
  if (!creditsAvailable(account, requiredCredits)) {
    return NextResponse.json({ error: 'insufficient_credits', required: requiredCredits, available: account.credits }, { status: 402 });
  }

  const expiresAt = new Date(Date.now() + retentionDays() * 86_400_000);
  try {
    const snapshot = await createBulkJob({
      ownerKey: ownerKeyFor(account), profile, totalRows: parsed.records.length, uniqueRows,
      invalidRows, duplicateRows, columns: { headers: parsed.headers, phoneColumn, consentColumn },
      expiresAt, rows,
    });
    await processBulkChunk(snapshot.job.id, 250);
    const completed = await import('@/lib/bulk-store').then(({ getBulkJob }) => getBulkJob(snapshot.job.id));
    const job = completed?.job || snapshot.job;
    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      total_rows: job.totalRows,
      unique_rows: job.uniqueRows,
      invalid_rows: job.invalidRows,
      duplicate_rows: job.duplicateRows,
      processed_rows: job.processedRows,
      poll_url: `/api/v1/bulk/jobs/${job.id}`,
      results_url: `/api/v1/bulk/jobs/${job.id}/results.csv`,
      report_url: `/api/v1/bulk/jobs/${job.id}/report`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'persistence_unavailable' ? message : 'bulk_job_create_failed' }, { status: 503 });
  }
}
