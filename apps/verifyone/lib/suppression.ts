import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { dbEnabled, prisma } from './db';
import { maskPhone, normalizePhone, sealEvidence, sha256 } from './audit-store';
import { decryptSecret, encryptSecret } from './platform-credentials';
import { encodeCsvCell } from './bulk-input';

export const SUPPRESSION_REASONS = ['opt_out', 'manual', 'import', 'complaint', 'legal_request'] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const SUPPRESSION_SOURCES = ['outcome_api', 'api', 'dashboard', 'csv_import', 'lead_intake'] as const;
export type SuppressionSource = (typeof SUPPRESSION_SOURCES)[number];

export type SuppressionRecord = {
  id: string;
  ownerKey: string;
  phoneHash: string;
  phoneMasked: string;
  phoneEncrypted: string | null;
  reason: string;
  source: string;
  requestedAt: string;
  createdAt: string;
  createdBy: string | null;
  sourceEvidenceId: string | null;
  addEvidenceId: string | null;
  removedAt: string | null;
  removedBy: string | null;
  removeReason: string | null;
  removeEvidenceId: string | null;
};

const STORE_FILE = path.join(process.cwd(), '.data', 'suppression.json');
let fileQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = fileQueue.then(work, work);
  fileQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readAllFile(): Promise<SuppressionRecord[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAllFile(rows: SuppressionRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(rows, null, 2));
}

function mapDbRow(row: {
  id: string;
  ownerKey: string;
  phoneHash: string;
  phoneMasked: string;
  phoneEncrypted: string | null;
  reason: string;
  source: string;
  requestedAt: Date;
  createdAt: Date;
  createdBy: string | null;
  sourceEvidenceId: string | null;
  addEvidenceId: string | null;
  removedAt: Date | null;
  removedBy: string | null;
  removeReason: string | null;
  removeEvidenceId: string | null;
}): SuppressionRecord {
  return {
    id: row.id,
    ownerKey: row.ownerKey,
    phoneHash: row.phoneHash,
    phoneMasked: row.phoneMasked,
    phoneEncrypted: row.phoneEncrypted,
    reason: row.reason,
    source: row.source,
    requestedAt: row.requestedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    sourceEvidenceId: row.sourceEvidenceId,
    addEvidenceId: row.addEvidenceId,
    removedAt: row.removedAt ? row.removedAt.toISOString() : null,
    removedBy: row.removedBy,
    removeReason: row.removeReason,
    removeEvidenceId: row.removeEvidenceId,
  };
}

function tryEncryptBestEffort(normalized: string, ownerKey: string): string | null {
  try {
    return encryptSecret(normalized);
  } catch {
    console.warn('[suppression] phone encryption unavailable; stored masked/hashed only', { ownerKey });
    return null;
  }
}

async function sealSuppressionAddEvidence(input: {
  normalized: string;
  ownerKey: string;
  reason: string;
  requestedAt: string;
  source: string;
  sourceEvidenceId?: string | null;
}): Promise<string> {
  try {
    const { evidence } = await sealEvidence({
      phone: input.normalized,
      channel: 'suppression',
      consent: null,
      decision: 'block',
      reason: input.reason,
      checks: {
        owner_key: input.ownerKey,
        requested_at: input.requestedAt,
        source: input.source,
        source_evidence_id: input.sourceEvidenceId ?? undefined,
      },
      callerKey: input.ownerKey,
    });
    return evidence.evidence_id;
  } catch {
    throw new Error('suppression_evidence_pending');
  }
}

export async function isSuppressed(
  ownerKey: string | null | undefined,
  phone: string,
): Promise<{ evaluated: boolean; listed: boolean; entry_requested_at?: string }> {
  if (!ownerKey) return { evaluated: false, listed: false };
  const normalized = normalizePhone(phone);
  if (!/^\+\d{7,15}$/.test(normalized)) return { evaluated: false, listed: false };
  const phoneHash = sha256(normalized);

  if (dbEnabled()) {
    const hit = await prisma.suppressionEntry.findFirst({
      where: { ownerKey, phoneHash, removedAt: null },
      select: { requestedAt: true },
    });
    return hit
      ? { evaluated: true, listed: true, entry_requested_at: hit.requestedAt.toISOString() }
      : { evaluated: true, listed: false };
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const hit = rows.find((r) => r.ownerKey === ownerKey && r.phoneHash === phoneHash && r.removedAt === null);
    return hit
      ? { evaluated: true, listed: true, entry_requested_at: hit.requestedAt }
      : { evaluated: true, listed: false };
  });
}

export async function addSuppression(input: {
  ownerKey: string;
  phone: string;
  reason: SuppressionReason;
  source: SuppressionSource;
  requestedAt?: Date;
  createdBy?: string | null;
  sourceEvidenceId?: string | null;
}): Promise<{ added: boolean; already_suppressed: boolean; entry: SuppressionRecord; evidence_id: string }> {
  const normalized = normalizePhone(input.phone);
  if (!/^\+\d{7,15}$/.test(normalized)) {
    throw new Error('invalid_phone');
  }
  const phoneHash = sha256(normalized);
  const requestedAt = input.requestedAt && !Number.isNaN(input.requestedAt.getTime()) ? input.requestedAt : new Date();

  if (dbEnabled()) {
    let active = await prisma.suppressionEntry.findFirst({
      where: { ownerKey: input.ownerKey, phoneHash, removedAt: null },
    });
    let added = false;

    if (!active) {
      const encrypted = tryEncryptBestEffort(normalized, input.ownerKey);
      try {
        active = await prisma.suppressionEntry.create({
          data: {
            ownerKey: input.ownerKey,
            phoneHash,
            phoneMasked: maskPhone(normalized),
            phoneEncrypted: encrypted,
            reason: input.reason,
            source: input.source,
            requestedAt,
            createdBy: input.createdBy ?? null,
            sourceEvidenceId: input.sourceEvidenceId ?? null,
            addEvidenceId: null,
          },
        });
        added = true;
      } catch (error: unknown) {
        const code = (error as { code?: string } | null)?.code;
        if (code === 'P2002') {
          active = await prisma.suppressionEntry.findFirstOrThrow({
            where: { ownerKey: input.ownerKey, phoneHash, removedAt: null },
          });
        } else {
          throw error;
        }
      }
    }

    let evidenceId = active.addEvidenceId;
    if (!evidenceId) {
      evidenceId = await sealSuppressionAddEvidence({
        normalized,
        ownerKey: input.ownerKey,
        reason: active.reason,
        requestedAt: active.requestedAt.toISOString(),
        source: active.source,
        sourceEvidenceId: active.sourceEvidenceId,
      });
      active = await prisma.suppressionEntry.update({
        where: { id: active.id },
        data: { addEvidenceId: evidenceId },
      });
    }

    return {
      added,
      already_suppressed: !added,
      entry: mapDbRow(active),
      evidence_id: evidenceId,
    };
  }

  return serialize(async () => {
    const rows = await readAllFile();
    let idx = rows.findIndex((r) => r.ownerKey === input.ownerKey && r.phoneHash === phoneHash && r.removedAt === null);
    let added = false;

    if (idx === -1) {
      const encrypted = tryEncryptBestEffort(normalized, input.ownerKey);
      const entry: SuppressionRecord = {
        id: `sup_${crypto.randomBytes(10).toString('hex')}`,
        ownerKey: input.ownerKey,
        phoneHash,
        phoneMasked: maskPhone(normalized),
        phoneEncrypted: encrypted,
        reason: input.reason,
        source: input.source,
        requestedAt: requestedAt.toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: input.createdBy ?? null,
        sourceEvidenceId: input.sourceEvidenceId ?? null,
        addEvidenceId: null,
        removedAt: null,
        removedBy: null,
        removeReason: null,
        removeEvidenceId: null,
      };
      rows.push(entry);
      await writeAllFile(rows);
      idx = rows.length - 1;
      added = true;
    }

    let active = rows[idx];
    let evidenceId = active.addEvidenceId;
    if (!evidenceId) {
      evidenceId = await sealSuppressionAddEvidence({
        normalized,
        ownerKey: input.ownerKey,
        reason: active.reason,
        requestedAt: active.requestedAt,
        source: active.source,
        sourceEvidenceId: active.sourceEvidenceId,
      });
      active = { ...active, addEvidenceId: evidenceId };
      rows[idx] = active;
      await writeAllFile(rows);
    }

    return {
      added,
      already_suppressed: !added,
      entry: active,
      evidence_id: evidenceId,
    };
  });
}

export async function removeSuppression(input: {
  ownerKey: string;
  phone: string;
  reason: string;
  removedBy?: string | null;
}): Promise<{ removed: boolean; not_found?: boolean; evidence_id?: string; entry?: SuppressionRecord }> {
  const cleanReason = input.reason.trim();
  if (!cleanReason) throw new Error('remove_reason_required');
  const normalized = normalizePhone(input.phone);
  if (!/^\+\d{7,15}$/.test(normalized)) throw new Error('invalid_phone');
  const phoneHash = sha256(normalized);

  if (dbEnabled()) {
    const existing = await prisma.suppressionEntry.findFirst({
      where: { ownerKey: input.ownerKey, phoneHash, removedAt: null },
    });
    if (!existing) return { removed: false, not_found: true };

    const { evidence } = await sealEvidence({
      phone: normalized,
      channel: 'suppression',
      consent: null,
      decision: 'allow',
      reason: cleanReason,
      checks: {
        owner_key: input.ownerKey,
        removed_entry_id: existing.id,
        requested_at: existing.requestedAt.toISOString(),
        source: existing.source,
      },
      callerKey: input.ownerKey,
    });
    if (!evidence?.evidence_id) throw new Error('suppression_evidence_pending');

    const updated = await prisma.suppressionEntry.update({
      where: { id: existing.id },
      data: {
        removedAt: new Date(),
        removedBy: input.removedBy ?? null,
        removeReason: cleanReason,
        removeEvidenceId: evidence.evidence_id,
      },
    });
    return { removed: true, evidence_id: evidence.evidence_id, entry: mapDbRow(updated) };
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const idx = rows.findIndex((r) => r.ownerKey === input.ownerKey && r.phoneHash === phoneHash && r.removedAt === null);
    if (idx === -1) return { removed: false, not_found: true };

    const existing = rows[idx];
    const { evidence } = await sealEvidence({
      phone: normalized,
      channel: 'suppression',
      consent: null,
      decision: 'allow',
      reason: cleanReason,
      checks: {
        owner_key: input.ownerKey,
        removed_entry_id: existing.id,
        requested_at: existing.requestedAt,
        source: existing.source,
      },
      callerKey: input.ownerKey,
    });
    if (!evidence?.evidence_id) throw new Error('suppression_evidence_pending');

    const updated: SuppressionRecord = {
      ...existing,
      removedAt: new Date().toISOString(),
      removedBy: input.removedBy ?? null,
      removeReason: cleanReason,
      removeEvidenceId: evidence.evidence_id,
    };
    rows[idx] = updated;
    await writeAllFile(rows);
    return { removed: true, evidence_id: evidence.evidence_id, entry: updated };
  });
}

export type MaskedSuppressionItem = Omit<SuppressionRecord, 'phoneEncrypted'> & { exportable: boolean };

function toMaskedItem(r: SuppressionRecord): MaskedSuppressionItem {
  const { phoneEncrypted, ...rest } = r;
  return { ...rest, exportable: Boolean(phoneEncrypted) };
}

export async function listSuppression(opts: {
  ownerKey: string;
  cursor?: string | null;
  limit?: number;
  searchPhone?: string | null;
}): Promise<{ items: MaskedSuppressionItem[]; next_cursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const searchNormalized = opts.searchPhone ? normalizePhone(opts.searchPhone) : '';
  const searchHash = searchNormalized && /^\+\d{7,15}$/.test(searchNormalized) ? sha256(searchNormalized) : null;

  if (dbEnabled()) {
    const rows = await prisma.suppressionEntry.findMany({
      where: {
        ownerKey: opts.ownerKey,
        removedAt: null,
        ...(searchHash ? { phoneHash: searchHash } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: slice.map((r) => toMaskedItem(mapDbRow(r))),
      next_cursor: hasMore ? slice[slice.length - 1].id : null,
    };
  }

  return serialize(async () => {
    const rows = (await readAllFile())
      .filter((r) => r.ownerKey === opts.ownerKey && r.removedAt === null && (!searchHash || r.phoneHash === searchHash))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const startIdx = opts.cursor ? Math.max(0, rows.findIndex((r) => r.id === opts.cursor) + 1) : 0;
    const slice = rows.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < rows.length;
    return {
      items: slice.map(toMaskedItem),
      next_cursor: hasMore ? slice[slice.length - 1].id : null,
    };
  });
}

export async function exportSuppressionCsv(ownerKey: string): Promise<string> {
  let rows: SuppressionRecord[];
  if (dbEnabled()) {
    const dbRows = await prisma.suppressionEntry.findMany({
      where: { ownerKey, removedAt: null },
      orderBy: [{ createdAt: 'desc' }],
    });
    rows = dbRows.map(mapDbRow);
  } else {
    rows = await serialize(async () =>
      (await readAllFile())
        .filter((r) => r.ownerKey === ownerKey && r.removedAt === null)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }

  const header = ['phone', 'reason', 'source', 'requested_at', 'created_at', 'add_evidence_id', 'number_unavailable_reason'].map(encodeCsvCell).join(',');
  const lines = rows.map((r) => {
    let phone = r.phoneMasked;
    let unavailableReason = '';
    if (r.phoneEncrypted) {
      try {
        phone = decryptSecret(r.phoneEncrypted);
      } catch {
        unavailableReason = 'encryption key unavailable when recorded';
      }
    } else {
      unavailableReason = 'encryption key unavailable when recorded';
    }
    return [phone, r.reason, r.source, r.requestedAt, r.createdAt, r.addEvidenceId ?? '', unavailableReason].map(encodeCsvCell).join(',');
  });
  return [header, ...lines].join('\r\n') + '\r\n';
}
