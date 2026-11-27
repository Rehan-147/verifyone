export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { listRunnableBulkJobs, purgeExpiredBulkJobs } from '@/lib/bulk-store';
import { processBulkChunk } from '@/lib/bulk-worker';
import { expireStale } from '@/lib/reviews';
import { purgeOldAttempts } from '@/lib/frequency';
import { purgeOldScans } from '@/lib/scan';

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('x-cron-secret') !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const purged = await purgeExpiredBulkJobs();
    const expiredReviews = await expireStale().catch(() => 0);
    // Attempts older than 7 days can no longer affect any 24-hour window.
    const purgedAttempts = await purgeOldAttempts(7).catch(() => 0);
    // Free-scan summaries are kept 30 days.
    const purgedScans = await purgeOldScans().catch(() => 0);
    const jobIds = await listRunnableBulkJobs(5);
    const jobs = [];
    for (const jobId of jobIds) {
      try { jobs.push(await processBulkChunk(jobId, 250)); }
      catch { jobs.push({ acquired: false, job_id: jobId, error: 'bulk_job_unavailable' }); }
    }
    return NextResponse.json({ purged_expired_jobs: purged, expired_review_items: expiredReviews, purged_call_attempts: purgedAttempts, purged_public_scans: purgedScans, jobs_processed: jobs.length, jobs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'persistence_unavailable' ? 'persistence_unavailable' : 'bulk_worker_unavailable' }, { status: 503 });
  }
}
