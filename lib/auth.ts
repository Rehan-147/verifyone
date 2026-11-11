// ============================================================
// AUTH + METERING — security-first (SOC 2 friendly by design)
// - API keys stored as SHA-256 hashes only (plaintext shown once at creation)
// - Every call metered against a credit balance
// - Sliding-window rate limit per key/IP
// - MVP persistence: .data/keys.json -> swap for Prisma ApiKey table in prod
// ============================================================
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PLANS, type PlanName } from './plans';
import { dbReady, dbCreateAccount, dbFindByEmail, dbApplyPlan, dbAuthenticate, dbMeter } from './auth-db';

const KEYS_FILE = path.join(process.cwd(), '.data', 'keys.json');

export type Account = {
  keyHash: string;
  email: string;
  plan: 'FREE' | 'STARTER' | 'GROWTH' | 'PRO';
  credits: number;
  createdAt: string;
  lastUsedAt?: string;
};

type KeyStore = Record<string, Account>;

const mem: { keys: KeyStore; loaded: boolean; rl: Map<string, number[]> } = {
  keys: {}, loaded: false, rl: new Map(),
};

async function load() {
  if (mem.loaded) return;
  try { mem.keys = JSON.parse(await fs.readFile(KEYS_FILE, 'utf8')) ?? {}; } catch {}
  mem.loaded = true;
}
async function persist() {
  try { await fs.mkdir(path.dirname(KEYS_FILE), { recursive: true }); await fs.writeFile(KEYS_FILE, JSON.stringify(mem.keys, null, 2)); } catch {}
}
export function sha256(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }

// Signup: create account + API key. Plaintext returned ONCE, hash stored.
export async function createAccount(email: string, plan: Account['plan'] = 'FREE') {
  if (dbReady()) return dbCreateAccount(email, plan);
  await load();
  const key = 'vk_live_' + crypto.randomBytes(24).toString('hex');
  const keyHash = sha256(key);
  const credits = plan === 'FREE' ? 1000 : PLANS[plan as PlanName]?.credits ?? 1000;
  mem.keys[keyHash] = { keyHash, email, plan, credits, createdAt: new Date().toISOString() };
  await persist();
  return { key, account: mem.keys[keyHash] };
}

export function extractKey(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  const k = req.headers.get('x-api-key') || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  return k && k.startsWith('vk_') ? k : null;
}

export async function findAccountByEmail(email: string): Promise<Account | null> {
  if (dbReady()) return dbFindByEmail(email);
  await load();
  const e = (email || '').toLowerCase();
  return Object.values(mem.keys).find((a) => a.email.toLowerCase() === e) ?? null;
}

// Grant a paid plan: sets plan, adds plan credits (renewals stack), creates the
// account if the customer paid before ever signing up.
export async function applyPlan(email: string, plan: 'FREE' | 'STARTER' | 'GROWTH' | 'PRO', credits: number) {
  if (dbReady()) return dbApplyPlan(email, plan, credits);
  await load();
  let acc = await findAccountByEmail(email);
  if (!acc) {
    const created = await createAccount(email, plan);
    acc = created.account;
  }
  acc.plan = plan;
  acc.credits += credits;
  await persist();
  return acc;
}

export async function authenticate(req: Request): Promise<Account | null> {
  const raw = extractKey(req);
  if (!raw) return null;
  if (dbReady()) return dbAuthenticate(raw);
  await load();
  const acc = mem.keys[sha256(raw)];
  if (acc) acc.lastUsedAt = new Date().toISOString();
  return acc ?? null;
}

export async function meter(acc: Account | null, cost: number): Promise<{ metered: boolean; creditsLeft?: number }> {
  if (!acc) return { metered: false };
  if (dbReady()) return dbMeter(acc, cost);
  acc.credits = Math.max(0, acc.credits - cost);
  await persist();
  return { metered: true, creditsLeft: acc.credits };
}

// Fail-closed admission: a metered call on a zero balance must REFUSE, not serve.
// The meter itself clamps at zero; this guard decides whether the call runs at all.
// Anonymous (unauthenticated) traffic is governed by the free-tier quota instead.
export function creditsAvailable(acc: Account | null): boolean {
  if (!acc) return true;
  return acc.credits > 0;
}

// Sliding-window rate limit: 120 req/min per identity
export function rateLimit(identity: string, limit = 120, windowMs = 60_000): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const arr = (mem.rl.get(identity) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  mem.rl.set(identity, arr);
  return { ok: true };
}
