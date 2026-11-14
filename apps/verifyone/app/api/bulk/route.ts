export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'moved', use: '/api/v1/bulk/jobs' }, { status: 410 });
}
