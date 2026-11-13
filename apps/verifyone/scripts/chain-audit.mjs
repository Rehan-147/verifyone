#!/usr/bin/env node
// Exhaustive hash-chain analyzer for the gate audit ledger.
//
// verifyChain() stops at the FIRST break, which hides everything after a pre-existing
// fault. This walks the whole file and reports every defect, so damage can be triaged
// without deleting rows.
//
//   node scripts/chain-audit.mjs                       # .data/audit.jsonl
//   node scripts/chain-audit.mjs --from 60             # only check appends after row 60
//   node scripts/chain-audit.mjs --file path.jsonl
//   node scripts/chain-audit.mjs --json                # machine-readable
//
// Exit code = number of link breaks (self-hash corruptions are reported separately).

import fs from 'node:fs';
import crypto from 'node:crypto';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? dflt : process.argv[i + 1];
};
const file = arg('file', '.data/audit.jsonl');
const from = Number(arg('from', 0));
const asJson = process.argv.includes('--json');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

if (!fs.existsSync(file)) {
  console.error('audit file not found: ' + file);
  process.exit(2);
}

const raw = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
const recs = raw.map((l) => {
  try { return JSON.parse(l); } catch { return null; }
});

const GENESIS = '0'.repeat(64);
let prev = GENESIS;
const unparsable = [];
const hashBad = [];
const linkBad = [];
const ordering = [];

for (let i = 0; i < recs.length; i++) {
  const rec = recs[i];
  if (!rec) {
    unparsable.push(i);
    prev = GENESIS; // resynchronise so one bad line does not flood the report
    continue;
  }

  // record_hash is the last key, so deleting it reproduces
  // sha256(JSON.stringify({ ...record, record_hash: undefined })) exactly.
  const body = { ...rec };
  delete body.record_hash;
  const recomputed = sha256(JSON.stringify(body));
  if (recomputed !== rec.record_hash) hashBad.push({ i, id: rec.evidence_id });

  if (i >= from) {
    if (rec.prev_hash !== prev) {
      linkBad.push({ i, id: rec.evidence_id, expected: prev, found: rec.prev_hash, created_at: rec.created_at });
    }
    const earlier = recs.slice(i + 1).find((r) => r && r.created_at && rec.created_at && r.created_at < rec.created_at);
    if (earlier) ordering.push({ i, id: rec.evidence_id, created_at: rec.created_at, later_row: earlier.created_at });
  }

  prev = rec.record_hash;
}

const summary = {
  file,
  records: recs.length,
  checked_from: from,
  link_breaks: linkBad,
  self_hash_corruptions: hashBad,
  unparsable_lines: unparsable,
  out_of_order: ordering,
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(file + '  records=' + recs.length + '  checked_from=' + from);
  console.log('  link breaks:            ' + linkBad.length);
  console.log('  self-hash corruptions:  ' + hashBad.length);
  console.log('  unparsable lines:       ' + unparsable.length);
  for (const b of linkBad.slice(0, 25)) {
    console.log('    row ' + String(b.i).padStart(4) + '  ' + b.id + '  prev_hash points at ' + String(b.found).slice(0, 12) + '…, expected ' + String(b.expected).slice(0, 12) + '…  @' + b.created_at);
  }
  if (linkBad.length > 25) console.log('    … ' + (linkBad.length - 25) + ' more');
  for (const b of hashBad.slice(0, 10)) console.log('    row ' + String(b.i).padStart(4) + '  ' + b.id + '  SELF-HASH MISMATCH');
  if (ordering.length) console.log('  rows written out of created_at order: ' + ordering.length + ' (first: row ' + ordering[0].i + ')');
}

process.exit(Math.min(255, linkBad.length + hashBad.length));
