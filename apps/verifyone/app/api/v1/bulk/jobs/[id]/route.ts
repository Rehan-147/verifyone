export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { ownerKeyFor } from '@/lib/platform-credentials';
import { getBulkJob } from '@/lib/bulk-store';
import { bulkSummary } from '@/lib/bulk-present';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  let account;
  try { account = await authenticate(req); }
  catch { return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 }); }
  if (!account) return NextResponse.json({ error: 'api_key_required' }, { status: 401 });
  try {
    const snapshot = await getBulkJob(params.id);
    if (!snapshot || snapshot.job.ownerKey !== ownerKeyFor(account)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(bulkSummary(snapshot.job, snapshot.rows));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'persistence_unavailable' ? 'persistence_unavailable' : 'bulk_job_unavailable' }, { status: 503 });
  }
}
