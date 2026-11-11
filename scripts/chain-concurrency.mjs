#!/usr/bin/env node
// Concurrency regression test for the audit hash chain.
//
// sealEvidence() assigns prev_hash from an in-memory tail and persists it with a later
// append. Before the fix, concurrent seals reached the file out of chain order and the
// ledger read as tampering. This fires a burst of seals through the real endpoints and
// then verifies that every record appended *by the burst* links correctly.
//
//   node scripts/chain-concurrency.mjs --base http://127.0.0.1:3000 --n 40
//   VERIFYONE_API_KEY=vk_live_... node scripts/chain-concurrency.mjs   # raises batch cap to 5000
//
// Needs a server running in this repo, because it reads .data/audit.jsonl to find where
// the burst landed. Exit 0 = chain held.

import fs from 'node:fs';
import crypto from 'node:crypto';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? dflt : process.argv[i + 1];
};
const BASE = (process.env.BASE || arg('base', 'http://127.0.0.1:3000')).replace(/\/$/, '');
const N = Number(process.env.N || arg('n', 40));
const KEY = process.env.VERIFYONE_API_KEY || arg('key', '');
const LEDGER = arg('file', '.data/audit.jsonl');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const bad = (m) => { console.log('  FAIL ' + m); failures++; };
const ok = (m) => console.log('  ok   ' + m);
let failures = 0;

const headers = { 'Content-Type': 'application/json' };
if (KEY) headers.Authorization = 'Bearer ' + KEY;

function readLedger() {
  if (!fs.existsSync(LEDGER)) return []; // fresh ledger: the whole file is ours to judge
  return fs.readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.trim());
}

console.log('Target ' + BASE + '   burst size ' + N + (KEY ? '   (keyed)' : '   (keyless, batch cap 200)'));

const before = readLedger();
const startIndex = before.length;
console.log('ledger grows from row ' + startIndex);

// ---------------------------------------------------------------- the bursts
async function burstParallel() {
  const t0 = Date.now();
  const res = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      fetch(BASE + '/api/v1/gate/phone', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: '+1415555' + String(2000 + i).padStart(4, '0'), channel: 'voice' }),
      }).then((r) => r.json())
    )
  );
  return { res, ms: Date.now() - t0 };
}

async function burstBatch() {
  const items = Array.from({ length: Math.min(N, 200) }, (_, i) => ({
    id: 'lead_' + i,
    phone: '+1212555' + String(1000 + i).padStart(4, '0'),
  }));
  const t0 = Date.now();
  const r = await fetch(BASE + '/api/v1/gate/batch', {
    method: 'POST',
    headers,
    body: JSON.stringify({ items, channel: 'voice' }),
  });
  const res = await r.json();
  return { res, ms: Date.now() - t0, status: r.status, count: Array.isArray(res.results) ? res.results.length : 0 };
}

async function verifyNewLabel(label) {
  const lines = readLedger();
  const grew = lines.length - startIndex;
  if (grew <= 0) {
    bad(label + ': the ledger did not grow — nothing was sealed');
    return;
  }

  // Re-derive the chain from the whole file, but only judge rows the burst wrote.
  let prev = '0'.repeat(64);
  let breaks = 0;
  let selfBad = 0;
  let unordered = 0;
  let lastStamp = '';
  for (let i = 0; i < lines.length; i++) {
    let rec;
    try { rec = JSON.parse(lines[i]); } catch { prev = '0'.repeat(64); continue; }
    const body = { ...rec };
    delete body.record_hash;
    if (sha256(JSON.stringify(body)) !== rec.record_hash) selfBad++;
    if (i >= startIndex) {
      if (rec.prev_hash !== prev) breaks++;
      if (lastStamp && rec.created_at < lastStamp) unordered++;
      lastStamp = rec.created_at;
    }
    prev = rec.record_hash;
  }

  const verdict = breaks === 0 && selfBad === 0;
  const note = unordered ? ' (' + unordered + ' rows out of created_at order)' : '';
  if (verdict) ok(label + ': ' + grew + ' new rows, chain links clean, self-hashes valid' + note);
  else bad(label + ': ' + breaks + ' link break(s), ' + selfBad + ' self-hash corruption(s)' + note);
}

const p = await burstParallel();
const idsP = new Set(p.res.map((r) => r.evidence_id).filter(Boolean));
console.log('\n== ' + N + ' concurrent POST /api/v1/gate/phone  (' + p.ms + 'ms)');
if (idsP.size === p.res.filter((r) => r.evidence_id).length && idsP.size > 1) ok('every call sealed its own evidence_id');
else bad('duplicate or missing evidence_ids across concurrent calls');
await new Promise((r) => setTimeout(r, 400)); // let stragglers finish their appends
await verifyNewLabel('parallel seals');

const b = await burstBatch();
console.log('\n== POST /api/v1/gate/batch with ' + b.count + ' items, 20-way internal pool  (' + b.ms + 'ms)');
if (b.status !== 200) bad('batch returned http ' + b.status + ': ' + JSON.stringify(b.res).slice(0, 160));
else {
  const ids = new Set((b.res.results || []).map((x) => x.evidence_id).filter(Boolean));
  if (ids.size === b.count) ok('batch sealed ' + ids.size + ' distinct evidence_ids');
  else bad('batch returned ' + b.count + ' results but only ' + ids.size + ' unique evidence_ids');
}
await new Promise((r) => setTimeout(r, 400));
await verifyNewLabel('batch seals');

const chain = await fetch(BASE + '/api/v1/gate/audit/chain').then((r) => r.json());
console.log('\n== GET /api/v1/gate/audit/chain');
console.log('  ' + JSON.stringify(chain));
console.log('  (this route halts at the first defect, so a pre-existing break below row ' + startIndex + ' still shows here)');

console.log('\n' + (failures === 0 ? 'chain held under concurrency' : failures + ' check(s) failed'));
process.exit(failures === 0 ? 0 : 1);
