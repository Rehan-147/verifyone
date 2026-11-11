// Tamper-evident audit store + free-tier quota tracking for the Pre-Dial Gate.
// Localhost MVP: JSONL file + in-memory fallback (serverless-safe).
// PROD TODO: swap persist() for Prisma GateAudit table or Supabase insert.
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { persistGateAuditRow, getEvidenceFromDb, summarizeGateFromDb } from './audit-db';

const DATA_DIR = path.join(process.cwd(), '.data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.jsonl');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');

export const FREE_TIER = { plan: 'FREE', monthly_limit: 500 };

type UsageMap = Record<string, { count: number; month: string }>;

const memory: { usage: UsageMap; lastHash: string; fsOk: boolean | null } = {
  usage: {},
  lastHash: '0'.repeat(64),
  fsOk: null,
};

function currentMonth() { return new Date().toISOString().slice(0, 7); }

async function ensureDir() {
  if (memory.fsOk === false) return false;
  try { await fs.mkdir(DATA_DIR, { recursive: true }); memory.fsOk = true; } catch { memory.fsOk = false; }
  return memory.fsOk;
}

// ---- Quota (free tier: 500 gate checks / month, no card) ----
export async function checkAndBumpQuota(callerKey: string) {
  const month = currentMonth();
  const rec = memory.usage[callerKey];
  if (!rec || rec.month !== month) memory.usage[callerKey] = { count: 0, month };
  const u = memory.usage[callerKey];
  if (u.count >= FREE_TIER.monthly_limit) {
    return { allowed: false as const, used: u.count, ...FREE_TIER };
  }
  u.count += 1;
  void (async () => {
    if (await ensureDir()) {
      try { await fs.writeFile(USAGE_FILE, JSON.stringify(memory.usage)); } catch {}
    }
  })();
  return { allowed: true as const, used: u.count, ...FREE_TIER };
}

export async function sha256ProxyUnused() {}

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ---- Chain tail loader (awaitable, avoids hot-reload race) ----
let chainReady: Promise<void> | null = null;
function initChain(): Promise<void> {
  if (!chainReady) {
    chainReady = (async () => {
      if (!(await ensureDir())) return;
      try {
        const lines = (await fs.readFile(AUDIT_FILE, 'utf8')).trim().split('\n').filter(Boolean);
        if (lines.length) {
          const last = JSON.parse(lines[lines.length - 1]);
          memory.lastHash = last.record_hash ?? memory.lastHash;
        }
        memory.usage = JSON.parse(await fs.readFile(USAGE_FILE, 'utf8')) ?? {};
      } catch {}
    })();
  }
  return chainReady;
}

// How many bytes of audit.jsonl this process has accounted for in memory.lastHash.
// -1 forces the first seal to read the real tail. If the file is ever a different size
// than we left it, somebody else appended (another dev server, a lost write) and the
// in-memory tail is stale, so we re-adopt from disk instead of forking the chain.
let accountedBytes = -1;

async function auditFileSize(): Promise<number> {
  try { return (await fs.stat(AUDIT_FILE)).size; } catch { return 0; }
}

async function adoptDiskTail(): Promise<void> {
  try {
    const buf = await fs.readFile(AUDIT_FILE);
    const lines = buf.toString('utf8').trim().split('\n').filter(Boolean);
    const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
    memory.lastHash = last?.record_hash ?? '0'.repeat(64);
    accountedBytes = buf.length;
  } catch {
    memory.lastHash = '0'.repeat(64);
    accountedBytes = 0;
  }
}

// prev_hash is assigned from memory.lastHash and only made durable by the append that
// follows it. fs.promises hands each appendFile to the thread pool independently, so two
// seals can reach the file in the opposite order to the one they were chained in — the
// ledger then reads as tampering when it is only reordering. Observed under
// POST /api/v1/gate/batch, which pools 20 concurrent seals. The queue makes the
// assign-hash-then-append step one-at-a-time, so disk order equals chain order.
let sealQueue: Promise<unknown> = Promise.resolve();

// ---- Sealed evidence record: hash-chained so any tampering is detectable ----
export type EvidenceInput = {
  phone: string;            // raw input (will be masked for storage)
  channel: string;
  consent: unknown;
  decision: string;
  reason: string;
  checks: Record<string, unknown>;
  callerKey: string;
};

export function sealEvidence(input: EvidenceInput): Promise<{ evidence: Record<string, any>; persistence: string }> {
  const run = sealQueue.then(() => sealExclusive(input));
  // A rejected seal must not wedge the queue behind it.
  sealQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function sealExclusive(input: EvidenceInput) {
  await initChain(); // never seal before the on-disk chain tail is loaded

  const size = await auditFileSize();
  if (size !== accountedBytes) {
    if (size > 0) await adoptDiskTail();
    else accountedBytes = size; // no file at all: keep the in-memory tail for the DB path
  }

  const evidence_id = 'ev_' + crypto.randomBytes(9).toString('hex');
  const created_at = new Date().toISOString();
  const record: Record<string, any> = {
    evidence_id,
    created_at,
    schema: 'verifyone.gate.evidence.v1',
    request: {
      phone_masked: maskPhone(input.phone),
      phone_hash: sha256(normalizePhone(input.phone)), // full number never stored in plaintext
      channel: input.channel,
      consent_declared: input.consent,
    },
    caller: sha256(input.callerKey),
    decision: input.decision,
    reason: input.reason,
    checks: input.checks,
    prev_hash: memory.lastHash,
  };
  record['record_hash'] = sha256(JSON.stringify({ ...record, record_hash: undefined }));

  let persistence = 'memory';
  if (await ensureDir()) {
    const line = JSON.stringify(record) + '\n';
    try {
      await fs.appendFile(AUDIT_FILE, line);
      persistence = 'file';
      accountedBytes += Buffer.byteLength(line);
    } catch {}
  }
  // Only advance the tail once the append is durable, so a failed write leaves the next
  // seal chaining from the last record that is actually on disk.
  memory.lastHash = record.record_hash;

  if (await persistGateAuditRow(record, input)) persistence = 'postgres';
  return { evidence: record, persistence };
}

export async function getEvidence(id: string) {
  const fromDb = await getEvidenceFromDb(id);
  if (fromDb) return fromDb;
  if (!(await ensureDir())) return null;
  try {
    const lines = (await fs.readFile(AUDIT_FILE, 'utf8')).trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const rec = JSON.parse(line);
      if (rec.evidence_id === id) return rec;
    }
  } catch {}
  return null;
}

// Verify the whole chain (lawyer/auditor mode): recomputes hashes
export async function verifyChain() {
  if (!(await ensureDir())) return { verifiable: false, reason: 'no persisted audit file' };
  try {
    const lines = (await fs.readFile(AUDIT_FILE, 'utf8')).trim().split('\n').filter(Boolean);
    let prev = '0'.repeat(64);
    for (const line of lines) {
      const rec = JSON.parse(line);
      const recompute = sha256(JSON.stringify({ ...rec, record_hash: undefined }));
      if (rec.prev_hash !== prev || recompute !== rec.record_hash) {
        return { verifiable: true, valid: false, broken_at: rec.evidence_id, checked: lines.length };
      }
      prev = rec.record_hash;
    }
    return { verifiable: true, valid: true, records: lines.length };
  } catch { return { verifiable: true, valid: false, broken_at: 'unreadable_file' }; }
}

export function normalizePhone(phone: string) {
  return (phone || '').replace(/[^+\d]/g, '');
}
export function maskPhone(phone: string) {
  const n = normalizePhone(phone);
  return n.length <= 4 ? '***' : n.slice(0, -4).replace(/\d/g, '*') + n.slice(-4);
}

// ---- Async ticket store (MVP: JSON file; prod: Redis/Postgres) ----
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
export async function saveTicket(t: { ticket_id: string; status: string; decision?: string; reason?: string; evidence_id?: string; phone?: string }) {
  let all: Record<string, unknown> = {};
  try { all = JSON.parse(await fs.readFile(TICKETS_FILE, 'utf8')) ?? {}; } catch {}
  all[t.ticket_id] = t;
  try { await fs.mkdir(DATA_DIR, { recursive: true }); await fs.writeFile(TICKETS_FILE, JSON.stringify(all)); } catch {}
}
export async function loadTicket(id: string) {
  try {
    const all = JSON.parse(await fs.readFile(TICKETS_FILE, 'utf8')) ?? {};
    return (all as Record<string, any>)[id] ?? null;
  } catch { return null; }
}

// ---- ROI digest: aggregate the audit trail into savings math ----
export async function summarizeGate(days = 7) {
  const dbStats = await summarizeGateFromDb(days);
  if (dbStats) return dbStats;
  if (!(await ensureDir())) return null;
  let lines: string[] = [];
  try { lines = (await fs.readFile(AUDIT_FILE, 'utf8')).trim().split('\n').filter(Boolean); } catch { return null; }
  const since = Date.now() - days * 86_400_000;
  let total = 0, allow = 0, block = 0;
  const byReason: Record<string, number> = {};
  // $0.10 = blended per-dial cost avoided (AI voice ~2min incl. connect attempts);
  // liability reasons each avoid one TCPA exposure event ($500 statutory floor, untrebled).
  const LIABILITY_REASONS = ['do_not_call_no_consent', 'ai_voice_consent_required', 'litigator_list', 'reassigned_number_consent_required'];
  let callsSaved = 0, liabilityAvoided = 0;
  for (const line of lines) {
    let rec: any; try { rec = JSON.parse(line); } catch { continue; }
    if (!rec.created_at || new Date(rec.created_at).getTime() < since) continue;
    total++;
    if (rec.decision === 'block') {
      block++; byReason[rec.reason] = (byReason[rec.reason] || 0) + 1;
      callsSaved++;
      if (LIABILITY_REASONS.includes(rec.reason)) liabilityAvoided++;
    } else allow++;
  }
  return {
    window_days: days,
    total_checks: total,
    allowed: allow,
    blocked: block,
    blocked_by_reason: byReason,
    savings: {
      dialing_cost_usd: Math.round(callsSaved * 0.10 * 100) / 100,
      tcpa_exposure_avoided_usd: Math.round(liabilityAvoided * 500),
      formula: '$0.10/dial avoided + $500 per liability event (statutory floor, untrebled, per 47 U.S.C. §227(b))',
    },
  };
}
