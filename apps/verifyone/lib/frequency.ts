// Call-frequency caps: how many times one customer may call the same number in a rolling window.
//
// Two sources of limits, the stricter one wins:
//   - state law (lib/data/state-frequency-rules.ts), e.g. Florida's 3 calls / 24 h;
//   - an optional account-wide cap the customer sets (Organization.callCap24h).
//
// The gate reads the current count to decide (evaluateFrequency). An ALLOW that will lead to a
// real call then reserves an attempt atomically (reserveAttempt), so concurrent requests can
// never push a number past its cap. Only the SHA-256 phone hash is stored.
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { dbEnabled, prisma, TX_OPTIONS } from './db';
import { normalizePhone, sha256 } from './audit-store';
import { NPA } from './data/npa';
import {
  FREQUENCY_WINDOW_HOURS,
  ORG_CALL_CAP_MAX,
  ORG_CALL_CAP_MIN,
  STATE_FREQUENCY_RULES,
} from './data/state-frequency-rules';

export type FrequencyLimit = {
  limit: number;
  /** 'state:FL' when a state rule is the binding limit, 'org' when the customer's cap is. */
  source: string;
  windowHours: number;
  citation?: string;
};

export type FrequencyCheck = {
  evaluated: boolean;
  attempts_24h: number;
  limit: number | null;
  source: string | null;
  exceeded: boolean;
  citation?: string;
  /** True when this decision recorded a call attempt (it counts toward future checks). */
  attempt_recorded?: boolean;
};

type AttemptRow = { id: string; ownerKey: string; phoneHash: string; source: string; createdAt: string };

const STORE_FILE = path.join(process.cwd(), '.data', 'call-attempts.json');
let fileQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = fileQueue.then(work, work);
  fileQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readFileRows(): Promise<AttemptRow[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(STORE_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileRows(rows: AttemptRow[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(rows));
}

function ensurePersistence() {
  if (!dbEnabled() && process.env.NODE_ENV === 'production') throw new Error('persistence_unavailable');
}

function windowStart(windowHours = FREQUENCY_WINDOW_HOURS): Date {
  return new Date(Date.now() - windowHours * 60 * 60 * 1000);
}

function hashFor(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!/^\+\d{7,15}$/.test(normalized)) return null;
  return sha256(normalized);
}

/** US/Canada state or province for a +1 number, from the generated area-code table. */
export function stateForPhone(phone: string): string | null {
  const n = normalizePhone(phone);
  if (!(n.startsWith('+1') && n.length === 12)) return null;
  return NPA[n.slice(2, 5)]?.state ?? null;
}

/** The customer's own cap, if they set one (organization accounts only). */
export async function getOrgCallCap(ownerKey: string): Promise<number | null> {
  if (!ownerKey.startsWith('org:') || !dbEnabled()) return null;
  const org = await prisma.organization.findUnique({
    where: { id: ownerKey.slice(4) },
    select: { callCap24h: true },
  });
  const cap = org?.callCap24h ?? null;
  return cap != null && cap >= ORG_CALL_CAP_MIN ? cap : null;
}

export async function setOrgCallCap(orgId: string, cap: number | null): Promise<number | null> {
  if (cap !== null && (!Number.isInteger(cap) || cap < ORG_CALL_CAP_MIN || cap > ORG_CALL_CAP_MAX)) {
    throw new Error('invalid_call_cap');
  }
  const org = await prisma.organization.update({ where: { id: orgId }, data: { callCap24h: cap }, select: { callCap24h: true } });
  return org.callCap24h;
}

/** The binding limit for this customer and number: the stricter of the state rule and the customer cap. */
export async function resolveFrequencyLimit(ownerKey: string, phone: string): Promise<FrequencyLimit | null> {
  const state = stateForPhone(phone);
  const rule = state ? STATE_FREQUENCY_RULES[state] : undefined;
  const orgCap = await getOrgCallCap(ownerKey);
  const candidates: FrequencyLimit[] = [];
  if (rule) candidates.push({ limit: rule.maxCalls, source: `state:${state}`, windowHours: rule.windowHours, citation: rule.citation });
  if (orgCap != null) candidates.push({ limit: orgCap, source: 'org', windowHours: FREQUENCY_WINDOW_HOURS });
  if (!candidates.length) return null;
  // Stricter limit wins; on a tie the legal rule is reported (it is the reason the customer cannot raise it).
  candidates.sort((a, b) => a.limit - b.limit || (a.source.startsWith('state:') ? -1 : 1));
  return candidates[0];
}

export async function countAttempts(ownerKey: string, phoneHash: string, windowHours = FREQUENCY_WINDOW_HOURS): Promise<number> {
  ensurePersistence();
  const since = windowStart(windowHours);
  if (dbEnabled()) {
    return prisma.callAttempt.count({ where: { ownerKey, phoneHash, createdAt: { gte: since } } });
  }
  return serialize(async () => {
    const rows = await readFileRows();
    return rows.filter((r) => r.ownerKey === ownerKey && r.phoneHash === phoneHash && new Date(r.createdAt) >= since).length;
  });
}

/** Read-only check used by the decision ladder. Throws if the attempt ledger cannot be read. */
export async function evaluateFrequency(ownerKey: string | null | undefined, phone: string): Promise<FrequencyCheck> {
  const none: FrequencyCheck = { evaluated: false, attempts_24h: 0, limit: null, source: null, exceeded: false };
  if (!ownerKey) return none;
  const phoneHash = hashFor(phone);
  if (!phoneHash) return none;
  const limit = await resolveFrequencyLimit(ownerKey, phone);
  const attempts = await countAttempts(ownerKey, phoneHash, limit?.windowHours);
  return {
    evaluated: true,
    attempts_24h: attempts,
    limit: limit?.limit ?? null,
    source: limit?.source ?? null,
    exceeded: limit != null && attempts >= limit.limit,
    ...(limit?.citation ? { citation: limit.citation } : {}),
  };
}

/**
 * Atomically record one call attempt, unless doing so would exceed `limit`.
 * Postgres: a transaction-scoped advisory lock per customer+number serialises concurrent
 * reservations (works through a transaction-mode pooler). File mode: the module's write queue.
 */
export async function reserveAttempt(input: {
  ownerKey: string;
  phone: string;
  limit: number | null;
  windowHours?: number;
  source: 'gate' | 'dial' | 'mcp';
}): Promise<{ reserved: boolean; attemptId: string | null; attempts: number }> {
  ensurePersistence();
  const phoneHash = hashFor(input.phone);
  if (!phoneHash) return { reserved: false, attemptId: null, attempts: 0 };
  const since = windowStart(input.windowHours);

  if (dbEnabled()) {
    return prisma.$transaction(async (tx) => {
      const lockKey = `${input.ownerKey}|${phoneHash}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const attempts = await tx.callAttempt.count({ where: { ownerKey: input.ownerKey, phoneHash, createdAt: { gte: since } } });
      if (input.limit != null && attempts >= input.limit) return { reserved: false, attemptId: null, attempts };
      const row = await tx.callAttempt.create({ data: { ownerKey: input.ownerKey, phoneHash, source: input.source } });
      return { reserved: true, attemptId: row.id, attempts: attempts + 1 };
    }, TX_OPTIONS);
  }

  return serialize(async () => {
    const rows = await readFileRows();
    const attempts = rows.filter((r) => r.ownerKey === input.ownerKey && r.phoneHash === phoneHash && new Date(r.createdAt) >= since).length;
    if (input.limit != null && attempts >= input.limit) return { reserved: false, attemptId: null, attempts };
    const row: AttemptRow = {
      id: crypto.randomUUID(),
      ownerKey: input.ownerKey,
      phoneHash,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    rows.push(row);
    await writeFileRows(rows);
    return { reserved: true, attemptId: row.id, attempts: attempts + 1 };
  });
}

/** Undo a reservation when the call never happened (e.g. the voice platform rejected it). */
export async function releaseAttempt(attemptId: string | null | undefined): Promise<void> {
  if (!attemptId) return;
  ensurePersistence();
  if (dbEnabled()) {
    await prisma.callAttempt.deleteMany({ where: { id: attemptId } });
    return;
  }
  await serialize(async () => {
    const rows = await readFileRows();
    await writeFileRows(rows.filter((r) => r.id !== attemptId));
  });
}

/** Drop attempts older than the retention period (they can no longer affect any window). */
export async function purgeOldAttempts(retentionDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  if (dbEnabled()) {
    const result = await prisma.callAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  }
  return serialize(async () => {
    const rows = await readFileRows();
    const kept = rows.filter((r) => new Date(r.createdAt) >= cutoff);
    await writeFileRows(kept);
    return rows.length - kept.length;
  });
}

/** Dev/test only: shift a customer's attempts for a number into the past. */
export async function backdateAttemptsForTest(ownerKey: string, phone: string, hours: number): Promise<number> {
  const phoneHash = hashFor(phone);
  if (!phoneHash) return 0;
  const shiftMs = hours * 60 * 60 * 1000;
  if (dbEnabled()) {
    const rows = await prisma.callAttempt.findMany({ where: { ownerKey, phoneHash }, select: { id: true, createdAt: true } });
    for (const row of rows) {
      await prisma.callAttempt.update({ where: { id: row.id }, data: { createdAt: new Date(row.createdAt.getTime() - shiftMs) } });
    }
    return rows.length;
  }
  return serialize(async () => {
    const rows = await readFileRows();
    let changed = 0;
    for (const row of rows) {
      if (row.ownerKey === ownerKey && row.phoneHash === phoneHash) {
        row.createdAt = new Date(new Date(row.createdAt).getTime() - shiftMs).toISOString();
        changed += 1;
      }
    }
    await writeFileRows(rows);
    return changed;
  });
}
