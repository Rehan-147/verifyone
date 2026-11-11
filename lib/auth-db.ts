import crypto from 'crypto';
import { prisma, dbEnabled } from './db';
import { PLANS, type PlanName } from './plans';

export function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export type DbAccount = {
  keyHash: string;
  email: string;
  plan: 'FREE' | 'STARTER' | 'GROWTH' | 'PRO';
  credits: number;
  createdAt: string;
  lastUsedAt?: string;
};

function mapUser(u: { email: string; plan: string; credits: number; createdAt: Date }, keyHash: string, lastUsedAt?: Date | null): DbAccount {
  return {
    keyHash,
    email: u.email,
    plan: (u.plan as DbAccount['plan']) || 'FREE',
    credits: u.credits,
    createdAt: u.createdAt.toISOString(),
    lastUsedAt: lastUsedAt?.toISOString(),
  };
}

export async function dbCreateAccount(email: string, plan: DbAccount['plan'] = 'FREE') {
  const key = 'vk_live_' + crypto.randomBytes(24).toString('hex');
  const keyHash = sha256(key);
  const credits = plan === 'FREE' ? 1000 : PLANS[plan as PlanName]?.credits ?? 1000;
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), plan, credits },
    update: {},
  });
  await prisma.apiKey.create({ data: { key: keyHash, userId: user.id } });
  return { key, account: mapUser(user, keyHash) };
}

export async function dbFindByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { apiKeys: true } });
  if (!user || !user.apiKeys[0]) return null;
  return mapUser(user, user.apiKeys[0].key, user.apiKeys[0].lastUsedAt);
}

export async function dbApplyPlan(email: string, plan: DbAccount['plan'], credits: number) {
  let acc = await dbFindByEmail(email);
  if (!acc) {
    const created = await dbCreateAccount(email, plan);
    acc = created.account;
  }
  const user = await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { plan, credits: { increment: credits } },
  });
  return mapUser(user, acc.keyHash, acc.lastUsedAt ? new Date(acc.lastUsedAt) : undefined);
}

export async function dbAuthenticate(rawKey: string) {
  const keyHash = sha256(rawKey);
  const row = await prisma.apiKey.findUnique({ where: { key: keyHash }, include: { user: true } });
  if (!row) return null;
  await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return mapUser(row.user, keyHash, new Date());
}

export async function dbMeter(acc: DbAccount, cost: number) {
  const user = await prisma.user.findUnique({ where: { email: acc.email.toLowerCase() } });
  if (!user) return { metered: false as const };
  const next = Math.max(0, user.credits - cost);
  await prisma.user.update({ where: { id: user.id }, data: { credits: next } });
  return { metered: true as const, creditsLeft: next };
}

export function dbReady() {
  return dbEnabled();
}
