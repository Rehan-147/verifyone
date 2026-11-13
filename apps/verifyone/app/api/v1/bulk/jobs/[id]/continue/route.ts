import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { ownerKeyFor } from '@/lib/platform-credentials';
import { getBulkJob } from '@/lib/bulk-store';
import { processBulkChunk } from '@/lib/bulk-worker';
import { bulkSummary } from '@/lib/bulk-present';

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  let account;
  try { account = await authenticate(req); }
  catch { return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 }); }
  if (!account) return NextResponse.json({ error: 'api_key_required' }, { status: 401 });
  try {
    const before = await getBulkJob(params.id);
    if (!before || before.job.ownerKey !== ownerKeyFor(account)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await processBulkChunk(params.id, 250);
    const after = await getBulkJob(params.id);
    return after ? NextResponse.json(bulkSummary(after.job, after.rows)) : NextResponse.json({ error: 'not_found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'persistence_unavailable' ? 'persistence_unavailable' : 'bulk_job_unavailable' }, { status: 503 });
  }
}
