export const dynamic = 'force-dynamic';

// GET /api/v1/gate/stats?days=7 — the ROI proof: what the gate blocked and what it saved.
// Wire this into a dashboard widget, cron digest, or customer success email.
import { NextRequest, NextResponse } from 'next/server';
import { summarizeGate } from '../../../../../lib/audit-store';

export async function GET(req: NextRequest) {
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days') || 7)));
  const s = await summarizeGate(days);
  if (!s) return NextResponse.json({ error: 'no_data' }, { status: 404 });
  return NextResponse.json(s);
}
