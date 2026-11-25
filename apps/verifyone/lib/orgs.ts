import crypto from 'crypto';
import { prisma, dbEnabled, TX_OPTIONS } from './db';

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export async function getOrCreateOrganization(clerkOrgId: string, name?: string) {
  if (!dbEnabled()) throw new Error('persistence_unavailable');
  const cleanName = (name || '').trim() || 'Organization';
  return prisma.organization.upsert({
    where: { clerkOrgId },
    create: { clerkOrgId, name: cleanName },
    update: name ? { name: cleanName, disabledAt: null } : {},
  });
}

export async function disableOrganization(clerkOrgId: string) {
  if (!dbEnabled()) throw new Error('persistence_unavailable');
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({ where: { clerkOrgId } });
    if (!org) return null;
    const now = new Date();
    await tx.organization.update({ where: { id: org.id }, data: { disabledAt: now } });
    await tx.apiKey.updateMany({ where: { orgId: org.id, revokedAt: null }, data: { revokedAt: now } });
    return org;
  }, TX_OPTIONS);
}

export async function createOrgApiKey(orgId: string, name: string, createdByClerkUserId?: string) {
  if (!dbEnabled()) throw new Error('persistence_unavailable');
  const cleanName = name.trim();
  if (!cleanName) throw new Error('key_name_required');
  const key = 'vk_live_' + crypto.randomBytes(24).toString('hex');
  const keyHash = sha256(key);
  const prefix = key.slice(0, 12);
  const last4 = key.slice(-4);
  const record = await prisma.apiKey.create({
    data: {
      keyHash,
      name: cleanName,
      prefix,
      last4,
      orgId,
      createdByClerkUserId: createdByClerkUserId || null,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      last4: true,
      createdByClerkUserId: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
  return { key, record };
}

export async function listOrgApiKeys(orgId: string) {
  if (!dbEnabled()) throw new Error('persistence_unavailable');
  return prisma.apiKey.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      last4: true,
      createdByClerkUserId: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
}

export async function revokeOrgApiKey(orgId: string, keyId: string) {
  if (!dbEnabled()) throw new Error('persistence_unavailable');
  const result = await prisma.apiKey.updateMany({
    where: { id: keyId, orgId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
