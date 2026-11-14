export const dynamic = 'force-dynamic';

// Sealed audit record retrieval — "the log your lawyer can read".
// GET  /api/v1/gate/audit/{evidence_id}  -> one sealed record
// GET  /api/v1/gate/audit?verify=chain   -> verify the entire hash chain
import { NextRequest, NextResponse } from 'next/server';
import { getEvidence, verifyChain } from '../../../../../../lib/audit-store';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  if (id === 'chain') {
    const result = await verifyChain();
    return NextResponse.json(result);
  }

  const record = await getEvidence(id);
  if (!record) {
    return NextResponse.json({ error: 'not_found', evidence_id: id }, { status: 404 });
  }

  // Recompute this record's hash so the reader can independently verify it
  const recomputed = require('crypto').createHash('sha256').update(
    JSON.stringify({ ...record, record_hash: undefined })
  ).digest('hex');

  return NextResponse.json({
    ...record,
    integrity: {
      hash_matches: recomputed === record.record_hash,
      note: 'Each record chains to the previous via prev_hash. Verify the full chain at /api/v1/gate/audit/chain',
    },
  });
}
