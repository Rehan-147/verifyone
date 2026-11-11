// Repair the LOCAL dev audit chain (.data/audit.jsonl, file-mode only).
//
// Why this exists: with file persistence, two dev-server processes can interleave
// appends (each re-adopts the on-disk tail, but safe chaining assumes ONE writer).
// Killing a server mid-write has the same effect. The result is a prev_hash break —
// single-record integrity stays valid, but /api/v1/gate/audit/chain goes red.
//
// What this does: re-stamps links — prev_hash chain + record_hash — while leaving
// every record's decision content untouched. It is a DEV-ONLY operational repair:
// never run it against a production ledger (production is Postgres-first; see
// README task list). A production repair must be an explicit, disclosed action.
//
// Usage (dev server STOPPED):
//   node scripts/repair-local-chain.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), '.data', 'audit.jsonl');
const backup = file + '.bak-' + Date.now();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

let lines;
try {
  lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
} catch (e) {
  console.error('No audit file to repair at', file, String(e));
  process.exit(1);
}

fs.writeFileSync(backup, lines.join('\n') + '\n');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let prev = '0'.repeat(64);
let repaired = 0;
let brokenLinks = 0;
const out = [];

for (const line of lines) {
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    // Unparsable (truncated) line — carry the chain forward over a tombstone link.
    brokenLinks++;
    out.push(JSON.stringify({ broken_record: 'unparsable_line', prev_hash: prev }));
    prev = sha(JSON.stringify({ broken_record: 'unparsable_line', prev_hash: prev }));
    continue;
  }
  if (rec.prev_hash !== prev) { rec.prev_hash = prev; brokenLinks++; }
  rec.record_hash = sha(JSON.stringify({ ...rec, record_hash: undefined }));
  out.push(JSON.stringify(rec));
  prev = rec.record_hash;
  repaired++;
}

fs.writeFileSync(file, out.join('\n') + '\n');
console.log(
  inspectRepair({ lines: lines.length, repaired, brokenLinks, backup }),
);
function inspectRepair({ lines, repaired, brokenLinks, backup }) {
  return `Repair complete: ${lines} records examined, ${repaired} re-stamped, ${brokenLinks} bad links fixed. Backup: ${backup}. Restart the dev server and verify: GET /api/v1/gate/audit/chain -> valid: true`;
}
