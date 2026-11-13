export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { persistRegistryMeta } from '../../../../lib/compliance-cache';
import { evaluateShieldReadiness } from '../../../../lib/compliance-policy';
import { ingestAllRegistries } from '../../../../lib/registry-ingest';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const ingest = await ingestAllRegistries();
  const health = ingest.health ?? persistRegistryMeta();
  const readiness = evaluateShieldReadiness();
  return NextResponse.json({
    ok: true,
    synced_at: new Date().toISOString(),
    ingest,
    health,
    shield_ready: readiness.shield_ready,
    note: 'Place FTC DNC at .data/dnc-us.txt and litigator export at .data/litigators.txt',
  });
}
