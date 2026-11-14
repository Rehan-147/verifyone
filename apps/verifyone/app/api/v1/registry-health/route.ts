export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { DATA_SOURCE_CATALOG } from '../../../../lib/data-sources';
import { evaluateShieldReadiness } from '../../../../lib/compliance-policy';
import { buildDataSourceReceipts } from '../../../../lib/compliance-cache';

export async function GET() {
  const readiness = evaluateShieldReadiness();
  return NextResponse.json({
    shield_ready: readiness.shield_ready,
    require_registries_in_production: readiness.require_registries,
    health: readiness.health,
    data_sources: buildDataSourceReceipts(),
    catalog: DATA_SOURCE_CATALOG,
  });
}
