import crypto from 'crypto';
import { prisma, dbEnabled } from './db';

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
function normalizePhone(phone: string) {
  return (phone || '').replace(/[^+\d]/g, '');
}

export async function persistGateAuditRow(record: Record<string, unknown>, input: {
  phone: string;
  channel: string;
  consent: unknown;
  decision: string;
  reason: string;
  checks: Record<string, unknown>;
  callerKey: string;
}) {
  if (!dbEnabled()) return false;
  try {
    await prisma.gateAudit.create({
      data: {
        evidenceId: String(record.evidence_id),
        callerKeyHash: sha256(input.callerKey),
        phoneHash: sha256(normalizePhone(input.phone)),
        channel: input.channel,
        decision: input.decision,
        reason: input.reason,
        checks: input.checks as object,
        consent: input.consent == null ? undefined : (input.consent as object),
        prevHash: String(record.prev_hash),
        recordHash: String(record.record_hash),
        createdAt: new Date(String(record.created_at)),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getEvidenceFromDb(id: string) {
  if (!dbEnabled()) return null;
  try {
    const row = await prisma.gateAudit.findUnique({ where: { evidenceId: id } });
    if (!row) return null;
    return {
      evidence_id: row.evidenceId,
      created_at: row.createdAt.toISOString(),
      schema: 'verifyone.gate.evidence.v1',
      request: { phone_hash: row.phoneHash, channel: row.channel, consent_declared: row.consent },
      caller: row.callerKeyHash,
      decision: row.decision,
      reason: row.reason,
      checks: row.checks,
      prev_hash: row.prevHash,
      record_hash: row.recordHash,
    };
  } catch {
    return null;
  }
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
