// Free public list scan (no account): screens an uploaded call list with the default gate
// profile and returns AGGREGATE counts only. Phone numbers are processed in memory and never
// stored or returned; we keep only the summary counts (30 days) and a salted IP hash for the
// per-IP daily limit. Anonymous scans have no internal DNC list or frequency history.
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { dbEnabled, prisma } from './db';
import { normalizePhone, sha256 } from './audit-store';
import { runPhoneGate } from './gate';
import { findColumn, parseCsvInput } from './bulk-input';
import { RISK_CATEGORIES } from './bulk-present';
import { toPublicDecision, toPublicReason } from './gate-contract';
import { buildDataSourceReceipts } from './compliance-cache';
import { allowDevMocks } from './compliance-policy';

export const PHONE_COLUMNS = ['phone', 'phone_number', 'mobile', 'number', 'to', 'to_number', 'cell'];
export const CONSENT_COLUMNS = ['consent_type', 'consent'];

function intEnv(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
export const SCAN_MAX_ROWS = () => intEnv('SCAN_MAX_ROWS', 1000);
export const SCAN_DAILY_LIMIT_PER_IP = () => intEnv('SCAN_DAILY_LIMIT_PER_IP', 3);
export const SCAN_GLOBAL_DAILY_ROWS = () => intEnv('SCAN_GLOBAL_DAILY_ROWS', 50_000);
const RETENTION_DAYS = 30;

export class ScanError extends Error {
  constructor(public code: string, public status: number, public detail?: Record<string, unknown>) {
    super(code);
  }
}

type ScanRecord = { id: string; ipHash: string; rowCount: number; summary: unknown; createdAt: string };
type LeadRecord = { id: string; email: string; scanId: string | null; consentToContact: boolean; ipHash: string; createdAt: string };

const SCANS_FILE = path.join(process.cwd(), '.data', 'public-scans.json');
const LEADS_FILE = path.join(process.cwd(), '.data', 'scan-leads.json');
let fileQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = fileQueue.then(work, work);
  fileQueue = next.then(() => undefined, () => undefined);
  return next;
}
async function readJsonFile<T>(file: string): Promise<T[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function writeJsonFile(file: string, rows: unknown[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows));
}
function ensurePersistence() {
  if (!dbEnabled() && process.env.NODE_ENV === 'production') throw new ScanError('persistence_unavailable', 503);
}

/** Salted hash so raw IPs are never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.EVIDENCE_EXPORT_SECRET || process.env.CRON_SECRET || 'verifyone-scan';
  return sha256(`scan|${salt}|${ip}`);
}

const dayAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

/** Throws ScanError('scan_limit_reached' | 'scan_capacity_reached') when over a daily limit. */
async function checkLimits(ipHash: string, rowsRequested: number) {
  const since = dayAgo();
  let scansByIp: number;
  let rowsToday: number;
  if (dbEnabled()) {
    scansByIp = await prisma.publicScan.count({ where: { ipHash, createdAt: { gte: since } } });
    const agg = await prisma.publicScan.aggregate({ _sum: { rowCount: true }, where: { createdAt: { gte: since } } });
    rowsToday = agg._sum.rowCount ?? 0;
  } else {
    const rows = await serialize(() => readJsonFile<ScanRecord>(SCANS_FILE));
    const recent = rows.filter((r) => new Date(r.createdAt) >= since);
    scansByIp = recent.filter((r) => r.ipHash === ipHash).length;
    rowsToday = recent.reduce((sum, r) => sum + r.rowCount, 0);
  }
  if (scansByIp >= SCAN_DAILY_LIMIT_PER_IP()) {
    throw new ScanError('scan_limit_reached', 429, { limit: SCAN_DAILY_LIMIT_PER_IP(), window_hours: 24 });
  }
  if (rowsToday + rowsRequested > SCAN_GLOBAL_DAILY_ROWS()) {
    throw new ScanError('scan_capacity_reached', 503, { retry_after_hours: 1 });
  }
}

async function saveScan(ipHash: string, rowCount: number, summary: unknown): Promise<string> {
  if (dbEnabled()) {
    const row = await prisma.publicScan.create({ data: { ipHash, rowCount, summary: summary as object } });
    return row.id;
  }
  return serialize(async () => {
    const rows = await readJsonFile<ScanRecord>(SCANS_FILE);
    const id = 'scan_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    rows.push({ id, ipHash, rowCount, summary, createdAt: new Date().toISOString() });
    await writeJsonFile(SCANS_FILE, rows);
    return id;
  });
}

function percent(count: number, total: number) {
  return total ? Math.round((count / total) * 10_000) / 100 : 0;
}

/**
 * Screen up to SCAN_MAX_ROWS numbers from a CSV and return aggregate counts. `now` lets tests
 * pin the calling-hours check (honoured only outside production, like the gate's debug_now).
 */
export async function runPublicScan(csvText: string, ip: string, opts: { debugNow?: string } = {}) {
  ensurePersistence();
  let parsed;
  try {
    parsed = parseCsvInput(csvText);
  } catch {
    throw new ScanError('invalid_csv', 400);
  }
  if (!parsed.records.length) throw new ScanError('empty_csv', 400);
  const phoneColumn = findColumn(parsed.headers, PHONE_COLUMNS);
  if (!phoneColumn) throw new ScanError('phone_column_not_found', 400, { headers_seen: parsed.headers.slice(0, 20), accepted: PHONE_COLUMNS });
  if (parsed.records.length > SCAN_MAX_ROWS()) {
    throw new ScanError('too_many_rows', 413, { max_rows: SCAN_MAX_ROWS(), rows: parsed.records.length });
  }
  const consentColumn = findColumn(parsed.headers, CONSENT_COLUMNS);

  const ipHash = hashIp(ip);
  await checkLimits(ipHash, parsed.records.length);

  // Normalise, drop invalid and duplicate numbers (screened once, like paid bulk audits).
  let invalid = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  const unique: Array<{ phone: string; consent: string }> = [];
  for (const record of parsed.records) {
    const phone = normalizePhone(String(record[phoneColumn] ?? ''));
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) { invalid += 1; continue; }
    if (seen.has(phone)) { duplicates += 1; continue; }
    seen.add(phone);
    const rawConsent = consentColumn ? String(record[consentColumn] ?? '').trim().toLowerCase() : '';
    unique.push({ phone, consent: rawConsent === 'express_written' || rawConsent === 'ebr' ? rawConsent : 'none' });
  }

  const debugNow = opts.debugNow && process.env.NODE_ENV !== 'production' ? opts.debugNow : undefined;
  const results: Array<{ decision: string; reason: string; publicReason: string }> = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(20, unique.length) }, async () => {
    while (cursor < unique.length) {
      const item = unique[cursor++];
      const gate = await runPhoneGate({
        phone: item.phone,
        channel: 'voice',
        consent: { declared: item.consent !== 'none', type: item.consent as 'express_written' | 'ebr' | 'none' },
        mode: 'fail_closed',
        profile: 'ai_outbound_shield',
        ownerKey: null,
        debug_now: debugNow,
      });
      results.push({ decision: toPublicDecision(gate.decision), reason: gate.reason, publicReason: toPublicReason(gate.reason, gate.checks) });
    }
  }));

  const screened = results.length;
  const byDecision = { ALLOW: 0, REVIEW: 0, DENY: 0 } as Record<string, number>;
  const byReason: Record<string, number> = {};
  for (const r of results) {
    byDecision[r.decision] = (byDecision[r.decision] || 0) + 1;
    if (r.decision !== 'ALLOW') byReason[r.publicReason] = (byReason[r.publicReason] || 0) + 1;
  }
  const riskBreakdown = Object.fromEntries(RISK_CATEGORIES.map(([name, reasons]) => {
    const count = results.filter((r) => (reasons as ReadonlySet<string>).has(r.reason)).length;
    return [name, { count, percent: percent(count, screened) }];
  }));

  const dataSources = buildDataSourceReceipts();
  const simulated = process.env.NODE_ENV !== 'production' && allowDevMocks();
  const sourcesMissing = dataSources.some((s) => ['ftc_dnc', 'litigator_trap'].includes(s.id) && s.status === 'missing');

  const summary = {
    totals: { rows: parsed.records.length, unique: unique.length, invalid, duplicates, screened },
    by_decision: byDecision,
    value: {
      risky_actions_prevented: byDecision.DENY,
      held_for_review: byDecision.REVIEW,
      clear_to_call: byDecision.ALLOW,
      risky_percent: percent(byDecision.DENY + byDecision.REVIEW, screened),
    },
    by_reason: byReason,
    risk_breakdown: riskBreakdown,
    data_sources: dataSources.map((s) => ({ id: s.id, vendor: s.vendor, status: s.status })),
    data_warning: simulated || sourcesMissing
      ? 'Some checks used simulated or unavailable data — this free scan is a preview, not valid for compliance decisions.'
      : null,
  };
  const scanId = await saveScan(ipHash, parsed.records.length, summary);
  return {
    scan_id: scanId,
    ...summary,
    limits: { max_rows: SCAN_MAX_ROWS(), scans_per_day: SCAN_DAILY_LIMIT_PER_IP() },
    privacy: 'Phone numbers were processed in memory and not stored. Only these aggregate counts are kept, for 30 days.',
    disclaimer: 'Compliance tooling, not legal advice. Row-level results and evidence records require an account or a paid audit.',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function saveScanLead(input: { email: string; scanId: string | null; consentToContact: boolean; ip: string }) {
  ensurePersistence();
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new ScanError('valid_email_required', 400);
  if (input.consentToContact !== true) throw new ScanError('consent_to_contact_required', 400);
  const scanId = input.scanId && /^[A-Za-z0-9_]{6,40}$/.test(input.scanId) ? input.scanId : null;
  const ipHash = hashIp(input.ip);
  if (dbEnabled()) {
    const recent = await prisma.scanLead.count({ where: { ipHash, createdAt: { gte: dayAgo() } } });
    if (recent >= 5) throw new ScanError('rate_limited', 429);
    const row = await prisma.scanLead.create({ data: { email, scanId, consentToContact: true, ipHash } });
    return { id: row.id };
  }
  return serialize(async () => {
    const rows = await readJsonFile<LeadRecord>(LEADS_FILE);
    if (rows.filter((r) => r.ipHash === ipHash && new Date(r.createdAt) >= dayAgo()).length >= 5) throw new ScanError('rate_limited', 429);
    const id = 'lead_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    rows.push({ id, email, scanId, consentToContact: true, ipHash, createdAt: new Date().toISOString() });
    await writeJsonFile(LEADS_FILE, rows);
    return { id };
  });
}

/** Drop scan summaries older than the retention period (leads are kept until deleted on request). */
export async function purgeOldScans(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  if (dbEnabled()) return (await prisma.publicScan.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
  return serialize(async () => {
    const rows = await readJsonFile<ScanRecord>(SCANS_FILE);
    const kept = rows.filter((r) => new Date(r.createdAt) >= cutoff);
    await writeJsonFile(SCANS_FILE, kept);
    return rows.length - kept.length;
  });
}
