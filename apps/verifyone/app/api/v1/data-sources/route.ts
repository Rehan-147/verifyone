export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { DATA_SOURCE_CATALOG } from '../../../../lib/data-sources';

export async function GET() {
  return NextResponse.json({ data_sources: DATA_SOURCE_CATALOG });
}
