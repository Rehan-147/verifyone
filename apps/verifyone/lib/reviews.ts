import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { dbEnabled, prisma } from './db';
import { maskPhone, normalizePhone, sealEvidence, sha256 } from './audit-store';
import { encryptSecret } from './platform-credentials';

export const REVIEW_TTL_HOURS = Number(process.env.REVIEW_TTL_HOURS ?? 72);
export const REVIEW_APPROVAL_TTL_HOURS = Number(process.env.REVIEW_APPROVAL_TTL_HOURS ?? 24);

// ── Overridability rules ────────────────────────────────────────────────────
// REVIEW reasons (all approvable)
export const APPROVABLE_REVIEW_REASONS = new Set([
  'timezone_unknown',
  'consent_cert_unverified',
  'reassigned_check_unavailable',
  'internal_dnc_unavailable',
]);

// DENY reasons that may be disputed
export const DISPUTEABLE_DENY_REASONS = new Set([
  'litigator_list',
  'disconnected',
]);

// All internal reasons that are NEVER overridable
export const NEVER_OVERRIDABLE_REASONS = new Set([
  'internal_dnc',
  'quiet_hours',
  'state_quiet_hours',
  'invalid_number',
  'do_not_call_no_consent',
  'ai_voice_consent_required',
  'blocked_by_customer',
  'registry_unavailable_fail_closed',
  'gate_unavailable_fail_closed',
  'fail_open_gate_unavailable',
  'internal_dnc_unavailable', // only as a dispute; it IS approvable as a REVIEW
]);

export function isOverridable(reason: string, kind: 'review' | 'dispute'): boolean {
  if (kind === 'review') return APPROVABLE_REVIEW_REASONS.has(reason);
  if (kind === 'dispute') return DISPUTEABLE_DENY_REASONS.has(reason);
  return false;
}

export function notOverridableMessage(reason: string): string {
  if (reason === 'internal_dnc') return 'An opt-out can only be lifted by removing the entry from the suppression list with a reason.';
  if (reason === 'quiet_hours' || reason === 'state_quiet_hours') return 'Quiet-hours blocks lift automatically — wait until permitted calling hours.';
  if (reason === 'invalid_number') return 'The number is structurally invalid and cannot be overridden.';
  if (reason === 'do_not_call_no_consent') return 'A federal/national DNC violation requires valid consent on file, not a manual override.';
  if (reason === 'ai_voice_consent_required') return 'FCC AI-voice consent is required; fix the consent record instead.';
  if (reason === 'blocked_by_customer') return 'The number is on the customer block list; remove it from that list.';
  if (reason.includes('unavailable') || reason.includes('gate_unavailable')) return 'Registry/gate unavailability is not overridable; it resolves automatically.';
  return 'This reason is not overridable via the review queue.';
}

// ── Types ───────────────────────────────────────────────────────────────────
export type ReviewStatus = 'open' | 'approved' | 'rejected' | 'expired';

export type ReviewItem = {
  id: string;
  ownerKey: string;
  kind: 'review' | 'dispute';
  gateEvidenceId: string;
  phoneHash: string;
  phoneMasked: string;
  phoneEncrypted: string | null;
  reason: string;
  publicReason: string;
  status: ReviewStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  note: string | null;
  resolutionEvidenceId: string | null;
  approvalExpiresAt: string | null;
  approvalUsedAt: string | null;
  approvalUsedEvidenceId: string | null;
};

// ── File mode store ──────────────────────────────────────────────────────────
const STORE_FILE = path.join(process.cwd(), '.data', 'reviews.json');
let fileQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = fileQueue.then(work, work);
  fileQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readAllFile(): Promise<ReviewItem[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAllFile(rows: ReviewItem[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(rows, null, 2));
}

// ── DB row mapper ────────────────────────────────────────────────────────────
function mapDbRow(row: {
  id: string; ownerKey: string; kind: string; gateEvidenceId: string;
  phoneHash: string; phoneMasked: string; phoneEncrypted: string | null;
  reason: string; publicReason: string; status: string;
  createdAt: Date; expiresAt: Date; resolvedAt: Date | null; resolvedBy: string | null;
  note: string | null; resolutionEvidenceId: string | null;
  approvalExpiresAt: Date | null; approvalUsedAt: Date | null; approvalUsedEvidenceId: string | null;
}): ReviewItem {
  return {
    id: row.id,
    ownerKey: row.ownerKey,
    kind: row.kind as 'review' | 'dispute',
    gateEvidenceId: row.gateEvidenceId,
    phoneHash: row.phoneHash,
    phoneMasked: row.phoneMasked,
    phoneEncrypted: row.phoneEncrypted,
    reason: row.reason,
    publicReason: row.publicReason,
    status: row.status as ReviewStatus,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedBy: row.resolvedBy,
    note: row.note,
    resolutionEvidenceId: row.resolutionEvidenceId,
    approvalExpiresAt: row.approvalExpiresAt ? row.approvalExpiresAt.toISOString() : null,
    approvalUsedAt: row.approvalUsedAt ? row.approvalUsedAt.toISOString() : null,
    approvalUsedEvidenceId: row.approvalUsedEvidenceId,
  };
}

function tryEncrypt(normalized: string): string | null {
  try { return encryptSecret(normalized); } catch { return null; }
}

// ── createReviewItem ─────────────────────────────────────────────────────────
export async function createReviewItem(input: {
  ownerKey: string;
  kind: 'review' | 'dispute';
  gateEvidenceId: string;
  phone: string;
  reason: string;
  publicReason: string;
}): Promise<ReviewItem> {
  const normalized = normalizePhone(input.phone);
  const phoneHash = sha256(normalized);
  const phoneMasked = maskPhone(normalized);
  const phoneEncrypted = tryEncrypt(normalized);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REVIEW_TTL_HOURS * 3_600_000);

  if (dbEnabled()) {
    // Return existing open item if one exists for same owner+hash+reason
    const existing = await prisma.reviewItem.findFirst({
      where: { ownerKey: input.ownerKey, phoneHash, reason: input.reason, status: 'open' },
    });
    if (existing) return mapDbRow(existing);

    try {
      const created = await prisma.reviewItem.create({
        data: {
          ownerKey: input.ownerKey,
          kind: input.kind,
          gateEvidenceId: input.gateEvidenceId,
          phoneHash,
          phoneMasked,
          phoneEncrypted,
          reason: input.reason,
          publicReason: input.publicReason,
          status: 'open',
          expiresAt,
        },
      });
      return mapDbRow(created);
    } catch (err: unknown) {
      // Partial unique index race — return existing
      if ((err as { code?: string })?.code === 'P2002') {
        const existing2 = await prisma.reviewItem.findFirstOrThrow({
          where: { ownerKey: input.ownerKey, phoneHash, reason: input.reason, status: 'open' },
        });
        return mapDbRow(existing2);
      }
      throw err;
    }
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const idx = rows.findIndex(
      (r) => r.ownerKey === input.ownerKey && r.phoneHash === phoneHash && r.reason === input.reason && r.status === 'open',
    );
    if (idx !== -1) return rows[idx];

    const item: ReviewItem = {
      id: `rv_${crypto.randomBytes(10).toString('hex')}`,
      ownerKey: input.ownerKey,
      kind: input.kind,
      gateEvidenceId: input.gateEvidenceId,
      phoneHash,
      phoneMasked,
      phoneEncrypted,
      reason: input.reason,
      publicReason: input.publicReason,
      status: 'open',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      resolvedAt: null,
      resolvedBy: null,
      note: null,
      resolutionEvidenceId: null,
      approvalExpiresAt: null,
      approvalUsedAt: null,
      approvalUsedEvidenceId: null,
    };
    rows.push(item);
    await writeAllFile(rows);
    return item;
  });
}

// ── openDispute ──────────────────────────────────────────────────────────────
export async function openDispute(input: {
  ownerKey: string;
  gateEvidenceId: string;
  phone: string;
  reason: string;
  publicReason: string;
  note: string;
}): Promise<ReviewItem> {
  if (!DISPUTEABLE_DENY_REASONS.has(input.reason)) {
    const err = new Error('not_overridable');
    (err as Error & { hint: string }).hint = notOverridableMessage(input.reason);
    throw err;
  }
  return createReviewItem({ ...input, kind: 'dispute' });
}

// ── approve ──────────────────────────────────────────────────────────────────
export async function approve(input: {
  id: string;
  ownerKey: string;
  resolvedBy: string;
  note: string;
}): Promise<ReviewItem> {
  const note = input.note.trim();
  if (!note) throw new Error('note_required');

  if (dbEnabled()) {
    const item = await prisma.reviewItem.findFirst({ where: { id: input.id, ownerKey: input.ownerKey } });
    if (!item) { const e = new Error('not_found'); (e as Error & { status: number }).status = 404; throw e; }
    if (item.status === 'expired' || (item.status === 'open' && new Date(item.expiresAt) < new Date())) {
      await prisma.reviewItem.update({ where: { id: item.id }, data: { status: 'expired' } });
      throw new Error('item_expired');
    }
    if (item.status !== 'open') throw new Error(`item_already_${item.status}`);

    const { evidence } = await sealEvidence({
      phone: item.phoneMasked,
      channel: 'review',
      consent: null,
      decision: 'allow',
      reason: `approved:${item.reason}`,
      checks: { review_id: item.id, resolved_by: input.resolvedBy, gate_evidence_id: item.gateEvidenceId },
      callerKey: input.resolvedBy,
    });

    const approvalExpiresAt = new Date(Date.now() + REVIEW_APPROVAL_TTL_HOURS * 3_600_000);
    const updated = await prisma.reviewItem.update({
      where: { id: item.id },
      data: {
        status: 'approved',
        resolvedAt: new Date(),
        resolvedBy: input.resolvedBy,
        note,
        resolutionEvidenceId: evidence.evidence_id,
        approvalExpiresAt,
      },
    });
    return mapDbRow(updated);
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const idx = rows.findIndex((r) => r.id === input.id && r.ownerKey === input.ownerKey);
    if (idx === -1) { const e = new Error('not_found'); (e as Error & { status: number }).status = 404; throw e; }
    const item = rows[idx];
    if (item.status === 'open' && new Date(item.expiresAt) < new Date()) {
      rows[idx] = { ...item, status: 'expired' };
      await writeAllFile(rows);
      throw new Error('item_expired');
    }
    if (item.status !== 'open') throw new Error(`item_already_${item.status}`);

    const { evidence } = await sealEvidence({
      phone: item.phoneMasked, channel: 'review', consent: null, decision: 'allow',
      reason: `approved:${item.reason}`,
      checks: { review_id: item.id, resolved_by: input.resolvedBy, gate_evidence_id: item.gateEvidenceId },
      callerKey: input.resolvedBy,
    });

    const approvalExpiresAt = new Date(Date.now() + REVIEW_APPROVAL_TTL_HOURS * 3_600_000);
    const updated: ReviewItem = {
      ...item, status: 'approved',
      resolvedAt: new Date().toISOString(),
      resolvedBy: input.resolvedBy, note,
      resolutionEvidenceId: evidence.evidence_id,
      approvalExpiresAt: approvalExpiresAt.toISOString(),
    };
    rows[idx] = updated;
    await writeAllFile(rows);
    return updated;
  });
}

// ── reject ───────────────────────────────────────────────────────────────────
export async function reject(input: {
  id: string;
  ownerKey: string;
  resolvedBy: string;
  note: string;
}): Promise<ReviewItem> {
  const note = input.note.trim();
  if (!note) throw new Error('note_required');

  if (dbEnabled()) {
    const item = await prisma.reviewItem.findFirst({ where: { id: input.id, ownerKey: input.ownerKey } });
    if (!item) { const e = new Error('not_found'); (e as Error & { status: number }).status = 404; throw e; }
    if (item.status === 'open' && new Date(item.expiresAt) < new Date()) {
      await prisma.reviewItem.update({ where: { id: item.id }, data: { status: 'expired' } });
      throw new Error('item_expired');
    }
    if (item.status !== 'open') throw new Error(`item_already_${item.status}`);

    const { evidence } = await sealEvidence({
      phone: item.phoneMasked, channel: 'review', consent: null, decision: 'block',
      reason: `rejected:${item.reason}`,
      checks: { review_id: item.id, resolved_by: input.resolvedBy, gate_evidence_id: item.gateEvidenceId },
      callerKey: input.resolvedBy,
    });

    const updated = await prisma.reviewItem.update({
      where: { id: item.id },
      data: { status: 'rejected', resolvedAt: new Date(), resolvedBy: input.resolvedBy, note, resolutionEvidenceId: evidence.evidence_id },
    });
    return mapDbRow(updated);
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const idx = rows.findIndex((r) => r.id === input.id && r.ownerKey === input.ownerKey);
    if (idx === -1) { const e = new Error('not_found'); (e as Error & { status: number }).status = 404; throw e; }
    const item = rows[idx];
    if (item.status === 'open' && new Date(item.expiresAt) < new Date()) {
      rows[idx] = { ...item, status: 'expired' };
      await writeAllFile(rows);
      throw new Error('item_expired');
    }
    if (item.status !== 'open') throw new Error(`item_already_${item.status}`);

    const { evidence } = await sealEvidence({
      phone: item.phoneMasked, channel: 'review', consent: null, decision: 'block',
      reason: `rejected:${item.reason}`,
      checks: { review_id: item.id, resolved_by: input.resolvedBy, gate_evidence_id: item.gateEvidenceId },
      callerKey: input.resolvedBy,
    });

    const updated: ReviewItem = {
      ...item, status: 'rejected',
      resolvedAt: new Date().toISOString(), resolvedBy: input.resolvedBy, note,
      resolutionEvidenceId: evidence.evidence_id,
    };
    rows[idx] = updated;
    await writeAllFile(rows);
    return updated;
  });
}

// ── listReviews ──────────────────────────────────────────────────────────────
export async function listReviews(opts: {
  ownerKey: string;
  status?: ReviewStatus | null;
  reason?: string | null;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: ReviewItem[]; next_cursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  if (dbEnabled()) {
    // Lazily expire stale open items first
    await expireStale();
    const rows = await prisma.reviewItem.findMany({
      where: {
        ownerKey: opts.ownerKey,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.reason ? { reason: opts.reason } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    return { items: slice.map(mapDbRow), next_cursor: hasMore ? slice[slice.length - 1].id : null };
  }

  return serialize(async () => {
    const rows = await readAllFile();
    // Lazy expiry
    let changed = false;
    const now = new Date();
    for (const r of rows) {
      if (r.status === 'open' && new Date(r.expiresAt) < now) {
        r.status = 'expired';
        changed = true;
      }
    }
    if (changed) await writeAllFile(rows);

    const filtered = rows
      .filter((r) =>
        r.ownerKey === opts.ownerKey &&
        (!opts.status || r.status === opts.status) &&
        (!opts.reason || r.reason === opts.reason),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const startIdx = opts.cursor ? Math.max(0, filtered.findIndex((r) => r.id === opts.cursor) + 1) : 0;
    const slice = filtered.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < filtered.length;
    return { items: slice, next_cursor: hasMore ? slice[slice.length - 1].id : null };
  });
}

// ── findUsableApproval ───────────────────────────────────────────────────────
export async function findUsableApproval(
  ownerKey: string,
  phone: string,
  reason: string,
): Promise<ReviewItem | null> {
  const normalized = normalizePhone(phone);
  const phoneHash = sha256(normalized);
  const now = new Date();

  if (dbEnabled()) {
    const item = await prisma.reviewItem.findFirst({
      where: {
        ownerKey,
        phoneHash,
        reason,
        status: 'approved',
        approvalExpiresAt: { gt: now },
        approvalUsedAt: null,
      },
    });
    return item ? mapDbRow(item) : null;
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const found = rows.find(
      (r) =>
        r.ownerKey === ownerKey &&
        r.phoneHash === phoneHash &&
        r.reason === reason &&
        r.status === 'approved' &&
        r.approvalExpiresAt != null &&
        new Date(r.approvalExpiresAt) > now &&
        r.approvalUsedAt == null,
    );
    return found ?? null;
  });
}

// ── consumeApproval (atomic) ─────────────────────────────────────────────────
// DB: conditional update WHERE approvalUsedAt IS NULL — only one concurrent
// caller can win this; all others find approvalUsedAt already set.
// File: serialize() queue means only one writer at a time.
export async function consumeApproval(input: {
  id: string;
  ownerKey: string;
  phone: string;
  resolvedBy: string;
  gateEvidenceId: string;
}): Promise<{ consumed: boolean; evidence_id: string | null }> {
  const normalized = normalizePhone(input.phone);
  const phoneHash = sha256(normalized);

  if (dbEnabled()) {
    // Atomic conditional update: only succeeds if approvalUsedAt is currently null
    const result = await prisma.reviewItem.updateMany({
      where: {
        id: input.id,
        ownerKey: input.ownerKey,
        phoneHash,
        status: 'approved',
        approvalUsedAt: null,
        approvalExpiresAt: { gt: new Date() },
      },
      data: { approvalUsedAt: new Date() },
    });
    if (result.count === 0) return { consumed: false, evidence_id: null };

    // Seal the consumption evidence
    const { evidence } = await sealEvidence({
      phone: input.phone,
      channel: 'review',
      consent: null,
      decision: 'allow',
      reason: 'approved_after_review',
      checks: {
        approval_id: input.id,
        reviewed_by: (await prisma.reviewItem.findUnique({ where: { id: input.id }, select: { resolvedBy: true } }))?.resolvedBy ?? 'unknown',
        gate_evidence_id: input.gateEvidenceId,
      },
      callerKey: input.resolvedBy,
    });

    await prisma.reviewItem.update({
      where: { id: input.id },
      data: { approvalUsedEvidenceId: evidence.evidence_id },
    });

    return { consumed: true, evidence_id: evidence.evidence_id };
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const idx = rows.findIndex(
      (r) =>
        r.id === input.id &&
        r.ownerKey === input.ownerKey &&
        r.phoneHash === phoneHash &&
        r.status === 'approved' &&
        r.approvalUsedAt == null &&
        r.approvalExpiresAt != null &&
        new Date(r.approvalExpiresAt) > new Date(),
    );
    if (idx === -1) return { consumed: false, evidence_id: null };

    rows[idx] = { ...rows[idx], approvalUsedAt: new Date().toISOString() };
    await writeAllFile(rows);

    const { evidence } = await sealEvidence({
      phone: input.phone,
      channel: 'review',
      consent: null,
      decision: 'allow',
      reason: 'approved_after_review',
      checks: {
        approval_id: input.id,
        reviewed_by: rows[idx].resolvedBy ?? 'unknown',
        gate_evidence_id: input.gateEvidenceId,
      },
      callerKey: input.resolvedBy,
    });

    rows[idx] = { ...rows[idx], approvalUsedEvidenceId: evidence.evidence_id };
    await writeAllFile(rows);

    return { consumed: true, evidence_id: evidence.evidence_id };
  });
}

// ── expireStale ───────────────────────────────────────────────────────────────
export async function expireStale(): Promise<number> {
  const now = new Date();

  if (dbEnabled()) {
    const result = await prisma.reviewItem.updateMany({
      where: { status: 'open', expiresAt: { lt: now } },
      data: { status: 'expired' },
    });
    return result.count;
  }

  return serialize(async () => {
    const rows = await readAllFile();
    let count = 0;
    for (const r of rows) {
      if (r.status === 'open' && new Date(r.expiresAt) < now) {
        r.status = 'expired';
        count++;
      }
    }
    if (count > 0) await writeAllFile(rows);
    return count;
  });
}

// ── Masked type for API ───────────────────────────────────────────────────────
export type MaskedReviewItem = Omit<ReviewItem, 'phoneEncrypted' | 'ownerKey'>;

export function toMaskedItem(r: ReviewItem): MaskedReviewItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { phoneEncrypted, ownerKey, ...rest } = r;
  return rest;
}

// ── Review stats for dashboard ────────────────────────────────────────────────
export async function reviewStats(ownerKey: string): Promise<{
  open_count: number;
  approval_rate_by_reason: Record<string, { approved: number; total: number; rate: number }>;
}> {
  const since = new Date(Date.now() - 30 * 24 * 3_600_000);

  if (dbEnabled()) {
    const [openCount, resolved] = await Promise.all([
      prisma.reviewItem.count({ where: { ownerKey, status: 'open' } }),
      prisma.reviewItem.findMany({
        where: { ownerKey, status: { in: ['approved', 'rejected'] }, resolvedAt: { gte: since } },
        select: { reason: true, status: true },
      }),
    ]);
    return buildStats(openCount, resolved);
  }

  return serialize(async () => {
    const rows = await readAllFile();
    const openCount = rows.filter((r) => r.ownerKey === ownerKey && r.status === 'open').length;
    const resolved = rows
      .filter((r) => r.ownerKey === ownerKey && (r.status === 'approved' || r.status === 'rejected') && r.resolvedAt != null && new Date(r.resolvedAt) >= since)
      .map((r) => ({ reason: r.reason, status: r.status }));
    return buildStats(openCount, resolved);
  });
}

function buildStats(openCount: number, resolved: { reason: string; status: string }[]) {
  const byReason: Record<string, { approved: number; total: number; rate: number }> = {};
  for (const r of resolved) {
    if (!byReason[r.reason]) byReason[r.reason] = { approved: 0, total: 0, rate: 0 };
    byReason[r.reason].total++;
    if (r.status === 'approved') byReason[r.reason].approved++;
  }
  for (const v of Object.values(byReason)) v.rate = v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0;
  return { open_count: openCount, approval_rate_by_reason: byReason };
}
