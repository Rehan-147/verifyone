#!/usr/bin/env node
// Import the local JSONL evidence chain into Postgres without changing its hashes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const file = path.resolve('.data/audit.jsonl');
const genesis = '0'.repeat(64);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonicalHash = (record) => sha256(JSON.stringify({ ...record, record_hash: undefined }));

function verify(rows) {
  let previousHash = genesis;
  let previousSeq = 0n;
  for (const row of rows) {
    const seq = BigInt(row.seq);
    const record = JSON.parse(row.recordJson);
    if (seq <= previousSeq || row.prevHash !== previousHash || record.prev_hash !== row.prevHash || record.record_hash !== row.recordHash || record.evidence_id !== row.evidenceId || canonicalHash(record) !== row.recordHash) {
      return { ok: false, records: rows.length, first_break_seq: Number(seq) };
    }
    previousSeq = seq;
    previousHash = row.recordHash;
  }
  return { ok: true, records: rows.length, first_break_seq: null };
}

try {
  const existing = await prisma.gateAudit.count();
  if (existing && !force) throw new Error(`GateAudit already contains ${existing} rows; rerun with --force to replace it`);

  const records = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line, index) => line.trim() ? [{ record: JSON.parse(line), seq: index + 1 }] : [])
    : [];

  await prisma.$transaction(async (tx) => {
    if (force) {
      await tx.gateAudit.deleteMany();
      await tx.chainTail.deleteMany();
    }
    for (let offset = 0; offset < records.length; offset += 500) {
      const batch = records.slice(offset, offset + 500).map(({ record, seq }) => {
        const request = record.request ?? {};
        return {
          evidenceId: record.evidence_id,
          seq: BigInt(seq),
          callerKeyHash: record.caller,
          phoneMasked: request.phone_masked ?? '***',
          phoneHash: request.phone_hash,
          channel: request.channel,
          decision: record.decision,
          reason: record.reason,
          checks: record.checks ?? {},
          consent: request.consent_declared ?? undefined,
          prevHash: record.prev_hash,
          recordHash: record.record_hash,
          recordJson: JSON.stringify(record),
          createdAt: new Date(record.created_at),
        };
      });
      await tx.gateAudit.createMany({ data: batch });
    }
    const last = records.at(-1);
    const lastSeq = BigInt(last?.seq ?? 0);
    if (last) {
      await tx.chainTail.upsert({
        where: { id: 1 },
        create: { id: 1, recordHash: last.record.record_hash, seq: lastSeq },
        update: { recordHash: last.record.record_hash, seq: lastSeq },
      });
    } else {
      await tx.chainTail.upsert({
        where: { id: 1 },
        create: { id: 1, recordHash: genesis, seq: BigInt(0) },
        update: { recordHash: genesis, seq: BigInt(0) },
      });
    }
  });

  const rows = await prisma.gateAudit.findMany({ orderBy: { seq: 'asc' } });
  const result = verify(rows);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
