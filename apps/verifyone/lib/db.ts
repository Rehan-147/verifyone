import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

function txMs(envName: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[envName] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const TX_OPTIONS = {
  maxWait: txMs('PRISMA_TX_MAX_WAIT_MS', 15_000),
  timeout: txMs('PRISMA_TX_TIMEOUT_MS', 15_000),
};

export function dbEnabled(): boolean {
  // Prevent Prisma's schemaEnvPath (.env) from hijacking file-mode CI/test runs in non-production.
  if (process.env.VERIFYONE_FORCE_FILE_MODE === '1' && process.env.NODE_ENV !== 'production') return false;
  return !!process.env.DATABASE_URL;
}
