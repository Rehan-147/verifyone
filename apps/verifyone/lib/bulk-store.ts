import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { dbEnabled, prisma } from './db';
import type { DataSourceReceipt } from './data-sources';

export type BulkJobStatus = 'pending' | 'running' | 'paused_insufficient_credits' | 'completed' | 'failed';
export type BulkRowStatus = 'pending' | 'done' | 'invalid' | 'duplicate';
export type BulkDataSourceReceipt = Omit<DataSourceReceipt, 'status'> & {
  status: DataSourceReceipt['status'] | 'mock' | 'simulated';
};
export type BulkRow = {
  id: string;
  jobId: string;
  rowIndex: number;
  original: Record<string, unknown>;
  phone: string | null;
  status: BulkRowStatus;
  decision: string | null;
  reason: string | null;
  riskScore: number | null;
  evidenceId: string | null;
};
export type BulkJob = {
  id: string;
  ownerKey: string;
  status: BulkJobStatus;
  profile: string;
  totalRows: number;
  uniqueRows: number;
  processedRows: number;
  invalidRows: number;
  duplicateRows: number;
  creditsCharged: number;
  columns: { headers: string[]; phoneColumn: string; consentColumn: string | null };
  dataSourceSnapshot: BulkDataSourceReceipt[] | null;
  simulatedData: boolean;
  leaseUntil: string | null;
  leaseToken: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
export type BulkSnapshot = { job: BulkJob; rows: BulkRow[] };
export type NewBulkRow = Omit<BulkRow, 'id' | 'jobId' | 'decision' | 'reason' | 'riskScore' | 'evidenceId'> & {
  decision?: string | null; reason?: string | null; riskScore?: number | null; evidenceId?: string | null;
};
export type BulkRowPatch = Pick<BulkRow, 'rowIndex' | 'status'> & Partial<Pick<BulkRow, 'decision' | 'reason' | 'riskScore' | 'evidenceId'>>;

const DIR = path.join(process.cwd(), '.data', 'bulk');
let fileQueue: Promise<unknown> = Promise.resolve();

function ensurePersistence() {
  if (process.env.NODE_ENV === 'production' && !dbEnabled()) throw new Error('persistence_unavailable');
}
function fileFor(id: string) {
  if (!/^bj_[a-f0-9]{24}$/.test(id)) throw new Error('bulk_job_not_found');
  return path.join(DIR, `${id}.json`);
}
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = fileQueue.then(fn);
  fileQueue = run.then(() => undefined, () => undefined);
  return run;
}
async function readFile(id: string): Promise<BulkSnapshot | null> {
  try { return JSON.parse(await fs.readFile(fileFor(id), 'utf8')) as BulkSnapshot; } catch { return null; }
}
async function writeFile(snapshot: BulkSnapshot) {
  await fs.mkdir(DIR, { recursive: true });
  const destination = fileFor(snapshot.job.id);
  const temp = `${destination}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(temp, JSON.stringify(snapshot));
  await fs.rename(temp, destination);
}
function mapDbJob(row: any): BulkJob {
  return {
    id: row.id, ownerKey: row.ownerKey, status: row.status as BulkJobStatus, profile: row.profile,
    totalRows: row.totalRows, uniqueRows: row.uniqueRows, processedRows: row.processedRows,
    invalidRows: row.invalidRows, duplicateRows: row.duplicateRows, creditsCharged: row.creditsCharged,
    columns: row.columns as BulkJob['columns'],
    dataSourceSnapshot: row.dataSourceSnapshot as BulkDataSourceReceipt[] | null,
    simulatedData: row.simulatedData,
    leaseUntil: row.leaseUntil?.toISOString() ?? null, leaseToken: row.leaseToken ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
  };
}
function mapDbRow(row: any): BulkRow {
  return {
    id: row.id, jobId: row.jobId, rowIndex: row.rowIndex, original: row.original as Record<string, unknown>,
    phone: row.phone, status: row.status as BulkRowStatus, decision: row.decision, reason: row.reason,
    riskScore: row.riskScore, evidenceId: row.evidenceId,
  };
}

export async function createBulkJob(input: {
  id?: string; ownerKey: string; profile: string; totalRows: number; uniqueRows: number;
  invalidRows: number; duplicateRows: number; columns: BulkJob['columns']; expiresAt: Date; rows: NewBulkRow[];
}): Promise<BulkSnapshot> {
  ensurePersistence();
  const id = input.id || `bj_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date();
  const initialProcessed = input.invalidRows + input.duplicateRows;
  if (dbEnabled()) {
    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.bulkJob.create({ data: {
        id, ownerKey: input.ownerKey, status: 'pending', profile: input.profile,
        totalRows: input.totalRows, uniqueRows: input.uniqueRows, processedRows: initialProcessed,
        invalidRows: input.invalidRows, duplicateRows: input.duplicateRows, creditsCharged: 0,
        simulatedData: false,
        columns: input.columns as import('@prisma/client').Prisma.InputJsonValue, expiresAt: input.expiresAt,
      } });
      if (input.rows.length) await tx.bulkRow.createMany({ data: input.rows.map((row) => ({
        jobId: id, rowIndex: row.rowIndex, original: row.original as import('@prisma/client').Prisma.InputJsonValue,
        phone: row.phone, status: row.status, decision: row.decision ?? null, reason: row.reason ?? null,
        riskScore: row.riskScore ?? null, evidenceId: row.evidenceId ?? null,
      })) });
      return created;
    });
    const created = await prisma.bulkJob.findUniqueOrThrow({ where: { id: job.id }, include: { rows: { orderBy: { rowIndex: 'asc' } } } });
    return { job: mapDbJob(created), rows: created.rows.map(mapDbRow) };
  }
  return serialize(async () => {
    const job: BulkJob = {
      id, ownerKey: input.ownerKey, status: 'pending', profile: input.profile,
      totalRows: input.totalRows, uniqueRows: input.uniqueRows, processedRows: initialProcessed,
      invalidRows: input.invalidRows, duplicateRows: input.duplicateRows, creditsCharged: 0,
      columns: input.columns, dataSourceSnapshot: null, simulatedData: false,
      leaseUntil: null, leaseToken: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: input.expiresAt.toISOString(),
    };
    const rows = input.rows.map((row) => ({ ...row, id: `br_${crypto.randomUUID()}`, jobId: id })) as BulkRow[];
    const snapshot = { job, rows };
    await writeFile(snapshot);
    return snapshot;
  });
}

export async function getBulkJob(id: string): Promise<BulkSnapshot | null> {
  ensurePersistence();
  if (dbEnabled()) {
    const row = await prisma.bulkJob.findUnique({ where: { id }, include: { rows: { orderBy: { rowIndex: 'asc' } } } });
    return row ? { job: mapDbJob(row), rows: row.rows.map(mapDbRow) } : null;
  }
  return serialize(() => readFile(id));
}

/** Atomically acquire a per-job lease and return the unique ownership token. */
export async function claimBulkJobLease(id: string, leaseMs = 120_000): Promise<string | null> {
  ensurePersistence();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const token = crypto.randomUUID();
  if (dbEnabled()) {
    const result = await prisma.bulkJob.updateMany({
      where: {
        id,
        status: { in: ['pending', 'running', 'paused_insufficient_credits'] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: { leaseUntil, leaseToken: token, status: 'running' },
    });
    return result.count === 1 ? token : null;
  }
  return serialize(async () => {
    const snapshot = await readFile(id);
    if (!snapshot || !['pending', 'running', 'paused_insufficient_credits'].includes(snapshot.job.status)) return null;
    if (snapshot.job.leaseUntil && new Date(snapshot.job.leaseUntil) > now) return null;
    snapshot.job.leaseUntil = leaseUntil.toISOString();
    snapshot.job.leaseToken = token;
    snapshot.job.status = 'running';
    snapshot.job.updatedAt = now.toISOString();
    await writeFile(snapshot);
    return token;
  });
}

type BulkJobPatch = Partial<Pick<BulkJob,
  'status' | 'processedRows' | 'creditsCharged' | 'simulatedData'>> & {
  dataSourceSnapshot?: BulkDataSourceReceipt[];
};

export async function updateBulkJobForLease(id: string, token: string, patch: BulkJobPatch, rowPatches: BulkRowPatch[] = []): Promise<boolean> {
  ensurePersistence();
  if (dbEnabled()) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.bulkJob.updateMany({
        where: { id, leaseToken: token },
        data: {
          ...patch,
          ...(patch.dataSourceSnapshot ? { dataSourceSnapshot: patch.dataSourceSnapshot as import('@prisma/client').Prisma.InputJsonValue } : {}),
          updatedAt: new Date(),
        },
      });
      if (claimed.count !== 1) return false;
      for (const row of rowPatches) {
        const { rowIndex, ...data } = row;
        await tx.bulkRow.update({ where: { jobId_rowIndex: { jobId: id, rowIndex } }, data });
      }
      return true;
    });
  }
  return serialize(async () => {
    const snapshot = await readFile(id);
    if (!snapshot || snapshot.job.leaseToken !== token) return false;
    Object.assign(snapshot.job, patch, { updatedAt: new Date().toISOString() });
    for (const rowPatch of rowPatches) {
      const row = snapshot.rows.find((item) => item.rowIndex === rowPatch.rowIndex);
      if (row) Object.assign(row, rowPatch);
    }
    await writeFile(snapshot);
    return true;
  });
}

export async function renewBulkJobLease(id: string, token: string, leaseMs = 120_000): Promise<boolean> {
  ensurePersistence();
  const leaseUntil = new Date(Date.now() + leaseMs);
  if (dbEnabled()) {
    const result = await prisma.bulkJob.updateMany({ where: { id, leaseToken: token }, data: { leaseUntil } });
    return result.count === 1;
  }
  return serialize(async () => {
    const snapshot = await readFile(id);
    if (!snapshot || snapshot.job.leaseToken !== token) return false;
    snapshot.job.leaseUntil = leaseUntil.toISOString();
    snapshot.job.updatedAt = new Date().toISOString();
    await writeFile(snapshot);
    return true;
  });
}

export async function releaseBulkJobLease(id: string, token: string): Promise<boolean> {
  ensurePersistence();
  if (dbEnabled()) {
    const result = await prisma.bulkJob.updateMany({
      where: { id, leaseToken: token },
      data: { leaseUntil: null, leaseToken: null },
    });
    return result.count === 1;
  }
  return serialize(async () => {
    const snapshot = await readFile(id);
    if (!snapshot || snapshot.job.leaseToken !== token) return false;
    snapshot.job.leaseUntil = null;
    snapshot.job.leaseToken = null;
    snapshot.job.updatedAt = new Date().toISOString();
    await writeFile(snapshot);
    return true;
  });
}

const SOURCE_STATUS_RANK: Record<BulkDataSourceReceipt['status'], number> = {
  failed: 6,
  missing: 5,
  mock: 4,
  simulated: 4,
  derived: 3,
  customer: 3,
  loaded: 2,
  live: 1,
};

export function mergeDataSourceReceipts(previous: BulkDataSourceReceipt[], current: DataSourceReceipt[]): BulkDataSourceReceipt[] {
  const merged = new Map(previous.map((receipt) => [receipt.id, receipt]));
  for (const receipt of current) {
    const old = merged.get(receipt.id);
    if (!old || SOURCE_STATUS_RANK[old.status] <= SOURCE_STATUS_RANK[receipt.status]) merged.set(receipt.id, receipt);
    else merged.set(receipt.id, { ...receipt, status: old.status });
  }
  return [...merged.values()];
}

export async function mergeBulkDataSourceSnapshot(
  id: string,
  token: string,
  receipts: DataSourceReceipt[],
  simulated: boolean,
): Promise<boolean> {
  const snapshot = await getBulkJob(id);
  if (!snapshot || snapshot.job.leaseToken !== token) return false;
  return updateBulkJobForLease(id, token, {
    dataSourceSnapshot: mergeDataSourceReceipts(snapshot.job.dataSourceSnapshot || [], receipts),
    ...(simulated ? { simulatedData: true } : {}),
  });
}

export async function listRunnableBulkJobs(limit: number): Promise<string[]> {
  ensurePersistence();
  if (dbEnabled()) {
    const jobs = await prisma.bulkJob.findMany({
      where: { status: { in: ['pending', 'running'] }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' }, take: limit, select: { id: true },
    });
    return jobs.map((job) => job.id);
  }
  return serialize(async () => {
    let names: string[];
    try { names = await fs.readdir(DIR); } catch { return []; }
    const active: Array<{ id: string; createdAt: string }> = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const id = name.slice(0, -5);
      const snapshot = await readFile(id).catch(() => null);
      if (snapshot && ['pending', 'running'].includes(snapshot.job.status) && new Date(snapshot.job.expiresAt) > new Date()) {
        active.push({ id, createdAt: snapshot.job.createdAt });
      }
    }
    return active.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit).map((x) => x.id);
  });
}

export async function purgeExpiredBulkJobs(): Promise<number> {
  ensurePersistence();
  const now = new Date();
  if (dbEnabled()) {
    const result = await prisma.bulkJob.deleteMany({ where: { expiresAt: { lte: now } } });
    return result.count;
  }
  return serialize(async () => {
    let names: string[];
    try { names = await fs.readdir(DIR); } catch { return 0; }
    let purged = 0;
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const id = name.slice(0, -5);
      const snapshot = await readFile(id).catch(() => null);
      if (snapshot && new Date(snapshot.job.expiresAt) <= now) {
        await fs.unlink(fileFor(id));
        purged += 1;
      }
    }
    return purged;
  });
}
