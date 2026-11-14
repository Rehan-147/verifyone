export const dynamic = 'force-dynamic';

// GET /api/v1/gate/ticket/{ticket_id} — poll an async gate ticket
import { NextRequest, NextResponse } from 'next/server';
import { loadTicket, getEvidence } from '../../../../../../lib/audit-store';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ticket = await loadTicket(id);
  if (!ticket) return NextResponse.json({ error: 'not_found', ticket_id: id }, { status: 404 });
  return NextResponse.json({
    ...ticket,
    evidence: ticket.evidence_id ? await getEvidence(ticket.evidence_id) : null,
  });
}
