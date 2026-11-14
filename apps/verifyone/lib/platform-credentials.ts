import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { dbEnabled, prisma } from './db';
import type { Account } from './auth';

export type VoicePlatform = 'vapi' | 'retell';
export type CredentialDefaults = Record<string, string>;
type CredentialRecord = {
  id: string; ownerKey: string; platform: VoicePlatform; encryptedKey: string;
  keyLast4: string; defaults: CredentialDefaults; verifiedAt: string | null;
  createdAt: string; updatedAt: string;
};
type IdempotencyRecord = {
  ownerKey: string; idempotencyKey: string; requestHash: string; state: 'in_progress' | 'completed';
  responseStatus?: number; response?: Record<string, unknown>; createdAt: string; expiresAt: string;
};
type FileStore = { credentials: CredentialRecord[]; idempotency: IdempotencyRecord[] };

const STORE_FILE = path.join(process.cwd(), '.data', 'platform-credentials.json');
let fileQueue: Promise<unknown> = Promise.resolve();
const memory: FileStore = { credentials: [], idempotency: [] };
let loaded = false;

function persistenceGuard() {
  if (process.env.NODE_ENV === 'production' && !dbEnabled()) throw new Error('persistence_unavailable');
}

function encryptionKey(): Buffer {
  const encoded = process.env.VERIFYONE_CREDENTIALS_KEY || '';
  let key: Buffer;
  try { key = Buffer.from(encoded, 'base64'); } catch { throw new Error('credentials_key_missing'); }
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new Error('credentials_key_missing');
  }
  return key;
}

function encrypt(apiKey: string) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return `v1:${nonce.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

function decrypt(encrypted: string) {
  const [, nonceText, tagText, dataText] = encrypted.split(':');
  if (!nonceText || !tagText || !dataText) throw new Error('credentials_unavailable');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(nonceText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64')), decipher.final()]).toString('utf8');
}

export function ownerKeyFor(account: Account): string {
  return `email:${account.email.trim().toLowerCase()}`;
}

async function loadFile() {
  if (loaded) return;
  try {
    const parsed = JSON.parse(await fs.readFile(STORE_FILE, 'utf8')) as Partial<FileStore>;
    memory.credentials = Array.isArray(parsed.credentials) ? parsed.credentials : [];
    memory.idempotency = Array.isArray(parsed.idempotency) ? parsed.idempotency : [];
  } catch {}
  loaded = true;
}

async function saveFile() {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  const temp = `${STORE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(memory));
  await fs.rename(temp, STORE_FILE);
}

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = fileQueue.then(fn);
  fileQueue = run.then(() => undefined, () => undefined);
  return run;
}

function mapCredential(row: any): CredentialRecord {
  return {
    id: row.id, ownerKey: row.ownerKey, platform: row.platform as VoicePlatform,
    encryptedKey: row.encryptedKey, keyLast4: row.keyLast4, defaults: row.defaults as CredentialDefaults,
    verifiedAt: row.verifiedAt ? new Date(row.verifiedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function putPlatformCredential(ownerKey: string, platform: VoicePlatform, apiKey: string, defaults: CredentialDefaults) {
  persistenceGuard();
  const encryptedKey = encrypt(apiKey);
  if (dbEnabled()) {
    const row = await prisma.platformCredential.upsert({
      where: { ownerKey_platform: { ownerKey, platform } },
      create: { ownerKey, platform, encryptedKey, keyLast4: apiKey.slice(-4), defaults, verifiedAt: null },
      update: { encryptedKey, keyLast4: apiKey.slice(-4), defaults, verifiedAt: null },
    });
    return mapCredential(row);
  }
  return serialize(async () => {
    await loadFile();
    const now = new Date().toISOString();
    let row = memory.credentials.find((x) => x.ownerKey === ownerKey && x.platform === platform);
    if (row) Object.assign(row, { encryptedKey, keyLast4: apiKey.slice(-4), defaults, verifiedAt: null, updatedAt: now });
    else {
      row = { id: crypto.randomUUID(), ownerKey, platform, encryptedKey, keyLast4: apiKey.slice(-4), defaults, verifiedAt: null, createdAt: now, updatedAt: now };
      memory.credentials.push(row);
    }
    await saveFile();
    return row;
  });
}

export async function getPlatformCredential(ownerKey: string, platform: VoicePlatform, includeSecret: true): Promise<(CredentialRecord & { apiKey: string }) | null>;
export async function getPlatformCredential(ownerKey: string, platform: VoicePlatform, includeSecret?: false): Promise<CredentialRecord | null>;
export async function getPlatformCredential(ownerKey: string, platform: VoicePlatform, includeSecret = false): Promise<CredentialRecord | (CredentialRecord & { apiKey: string }) | null> {
  persistenceGuard();
  if (dbEnabled()) {
    const row = await prisma.platformCredential.findUnique({ where: { ownerKey_platform: { ownerKey, platform } } });
    if (!row) return null;
    const mapped = mapCredential(row);
    return includeSecret ? { ...mapped, apiKey: decrypt(mapped.encryptedKey) } : mapped;
  }
  return serialize(async () => {
    await loadFile();
    const row = memory.credentials.find((x) => x.ownerKey === ownerKey && x.platform === platform) ?? null;
    if (!row) return null;
    return includeSecret ? { ...row, apiKey: decrypt(row.encryptedKey) } : row;
  });
}

export async function deletePlatformCredential(ownerKey: string, platform: VoicePlatform) {
  persistenceGuard();
  if (dbEnabled()) {
    await prisma.platformCredential.deleteMany({ where: { ownerKey, platform } });
    return;
  }
  await serialize(async () => {
    await loadFile();
    memory.credentials = memory.credentials.filter((x) => x.ownerKey !== ownerKey || x.platform !== platform);
    await saveFile();
  });
}

export type IdempotencyClaim =
  | { kind: 'claimed' }
  | { kind: 'replay'; status: number; response: Record<string, unknown> }
  | { kind: 'conflict' | 'in_progress' };

function idempotencyState(row: any, requestHash: string): IdempotencyClaim {
  if (row.requestHash !== requestHash) return { kind: 'conflict' };
  if (row.state === 'completed' && row.response) return { kind: 'replay', status: row.responseStatus || 200, response: row.response as Record<string, unknown> };
  return { kind: 'in_progress' };
}

export async function claimDialIdempotency(ownerKey: string, idempotencyKey: string, requestHash: string): Promise<IdempotencyClaim> {
  persistenceGuard();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dbEnabled()) {
    const existing = await prisma.dialIdempotency.findUnique({ where: { ownerKey_idempotencyKey: { ownerKey, idempotencyKey } } });
    if (existing && existing.expiresAt > now) return idempotencyState(existing, requestHash);
    if (existing) await prisma.dialIdempotency.delete({ where: { id: existing.id } });
    try {
      await prisma.dialIdempotency.create({ data: { ownerKey, idempotencyKey, requestHash, expiresAt } });
      return { kind: 'claimed' };
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const raced = await prisma.dialIdempotency.findUnique({ where: { ownerKey_idempotencyKey: { ownerKey, idempotencyKey } } });
        if (raced) return idempotencyState(raced, requestHash);
      }
      throw err;
    }
  }
  return serialize(async () => {
    await loadFile();
    const existing = memory.idempotency.find((x) => x.ownerKey === ownerKey && x.idempotencyKey === idempotencyKey);
    if (existing && new Date(existing.expiresAt) > now) return idempotencyState(existing, requestHash);
    memory.idempotency = memory.idempotency.filter((x) => x !== existing);
    memory.idempotency.push({ ownerKey, idempotencyKey, requestHash, state: 'in_progress', createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
    await saveFile();
    return { kind: 'claimed' };
  });
}

export async function completeDialIdempotency(ownerKey: string, idempotencyKey: string, requestHash: string, status: number, response: Record<string, unknown>) {
  persistenceGuard();
  if (dbEnabled()) {
    await prisma.dialIdempotency.updateMany({
      where: { ownerKey, idempotencyKey, requestHash, state: 'in_progress' },
      data: { state: 'completed', responseStatus: status, response: response as import('@prisma/client').Prisma.InputJsonValue },
    });
    return;
  }
  await serialize(async () => {
    await loadFile();
    const row = memory.idempotency.find((x) => x.ownerKey === ownerKey && x.idempotencyKey === idempotencyKey && x.requestHash === requestHash);
    if (row) Object.assign(row, { state: 'completed', responseStatus: status, response });
    await saveFile();
  });
}

export async function releaseDialIdempotency(ownerKey: string, idempotencyKey: string) {
  persistenceGuard();
  if (dbEnabled()) {
    await prisma.dialIdempotency.deleteMany({
      where: { ownerKey, idempotencyKey, state: 'in_progress' },
    });
    return;
  }
  await serialize(async () => {
    await loadFile();
    memory.idempotency = memory.idempotency.filter((x) =>
      x.ownerKey !== ownerKey || x.idempotencyKey !== idempotencyKey || x.state !== 'in_progress');
    await saveFile();
  });
}
