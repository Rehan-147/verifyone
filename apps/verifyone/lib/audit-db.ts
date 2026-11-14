import { prisma, dbEnabled } from './db';

const GENESIS_HASH = '0'.repeat(64);

type DbEvidenceRecord = Record<string, any>;

function rowToEvidenceRecord(row: any): DbEvidenceRecord {
  return JSON.parse(row.recordJson);
}

/** Serialize evidence creation around a locked DB tail; all failures propagate. */
export async function sealGateAuditDb(buildRecord: (prevHash: string) => DbEvidenceRecord) {
  if (!dbEnabled()) throw new Error('persistence_unavailable');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "ChainTail" ("id", "recordHash", "seq", "updatedAt") VALUES (1, ${GENESIS_HASH}, 0, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING`;
    const tails = await tx.$queryRaw<Array<{ recordHash: string; seq: bigint }>>`SELECT "recordHash", "seq" FROM "ChainTail" WHERE "id" = 1 FOR UPDATE`;
    const tail = tails[0];
    if (!tail) throw new Error('chain_tail_unavailable');

    const record = buildRecord(tail.recordHash);
    const nextSeq = BigInt(tail.seq) + BigInt(1);
    await tx.gateAudit.create({
      data: {
        evidenceId: String(record.evidence_id),
        seq: nextSeq,
        callerKeyHash: String(record.caller),
        phoneMasked: String(record.request.phone_masked),
        phoneHash: String(record.request.phone_hash),
        channel: String(record.request.channel),
        decision: String(record.decision),
        reason: String(record.reason),
        checks: record.checks as object,
        consent: record.request.consent_declared == null ? undefined : record.request.consent_declared as object,
        prevHash: String(record.prev_hash),
        recordHash: String(record.record_hash),
        recordJson: JSON.stringify(record),
        createdAt: new Date(String(record.created_at)),
      },
    });
    await tx.chainTail.update({ where: { id: 1 }, data: { recordHash: String(record.record_hash), seq: nextSeq } });
    return record;
  });
}

export async function verifyGateAuditDb(rehash: (record: DbEvidenceRecord) => string) {
  const rows = await prisma.gateAudit.findMany({ orderBy: { seq: 'asc' } });
  let prevHash = GENESIS_HASH;
  let previousSeq = BigInt(0);
  for (const row of rows) {
    const seq = BigInt(row.seq);
    const record = rowToEvidenceRecord(row);
    if (seq <= previousSeq || row.prevHash !== prevHash || record.prev_hash !== row.prevHash || record.record_hash !== row.recordHash || record.evidence_id !== row.evidenceId || rehash(record) !== row.recordHash) {
      return { ok: false, valid: false, records: rows.length, first_break_seq: Number(seq) };
    }
    previousSeq = seq;
    prevHash = row.recordHash;
  }
  return { ok: true, valid: true, records: rows.length, first_break_seq: null };
}

export async function getEvidenceFromDb(id: string) {
  if (!dbEnabled()) return null;
  const row = await prisma.gateAudit.findUnique({ where: { evidenceId: id } });
  return row ? rowToEvidenceRecord(row) : null;
}

export async function listAuditsForExport(opts: { from?: Date; to?: Date; limit?: number }) {
  if (!dbEnabled()) return [];
  const limit = Math.min(opts.limit ?? 10_000, 50_000);
  return prisma.gateAudit.findMany({
    where: {
      createdAt: {
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lte: opts.to } : {}),
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function summarizeGateFromDb(days = 7) {
  if (!dbEnabled()) return null;
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.gateAudit.findMany({ where: { createdAt: { gte: since } } });
  let allow = 0, block = 0;
  const byReason: Record<string, number> = {};
  const LIABILITY = ['do_not_call_no_consent', 'ai_voice_consent_required', 'litigator_list', 'reassigned_number_consent_required'];
  let liabilityAvoided = 0;
  for (const r of rows) {
    if (r.decision === 'block') {
      block++;
      byReason[r.reason] = (byReason[r.reason] || 0) + 1;
      if (LIABILITY.includes(r.reason)) liabilityAvoided++;
    } else allow++;
  }
  return {
    window_days: days,
    total_checks: rows.length,
    allowed: allow,
    blocked: block,
    blocked_by_reason: byReason,
    savings: {
      dialing_cost_usd: Math.round(block * 0.1 * 100) / 100,
      tcpa_exposure_avoided_usd: liabilityAvoided * 500,
      formula: '$0.10/dial avoided + $500 per liability event (statutory floor, untrebled)',
    },
    source: 'postgres',
  };
}

export function auditsToCsv(rows: Awaited<ReturnType<typeof listAuditsForExport>>): string {
  const header = 'evidence_id,created_at,decision,reason,channel,phone_hash,caller_key_hash,record_hash';
  const lines = rows.map((r) =>
    [r.evidenceId, r.createdAt.toISOString(), r.decision, r.reason, r.channel, r.phoneHash, r.callerKeyHash, r.recordHash]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header, ...lines].join('\n');
}
