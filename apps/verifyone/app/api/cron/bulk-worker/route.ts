export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { listRunnableBulkJobs, purgeExpiredBulkJobs } from '@/lib/bulk-store';
import { processBulkChunk } from '@/lib/bulk-worker';

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('x-cron-secret') !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const purged = await purgeExpiredBulkJobs();
    const jobIds = await listRunnableBulkJobs(5);
    const jobs = [];
    for (const jobId of jobIds) {
      try { jobs.push(await processBulkChunk(jobId, 250)); }
      catch { jobs.push({ acquired: false, job_id: jobId, error: 'bulk_job_unavailable' }); }
    }
    return NextResponse.json({ purged_expired_jobs: purged, jobs_processed: jobs.length, jobs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'persistence_unavailable' ? 'persistence_unavailable' : 'bulk_worker_unavailable' }, { status: 503 });
  }
}
