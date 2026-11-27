// Free public list scan: aggregate-only results, no stored numbers, limits, lead capture.
import fs from 'node:fs/promises';
import path from 'node:path';

const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const dbMode = process.env.DB_MODE === '1';
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const readJson = (res) => res.json().catch(() => ({}));
// A fresh client IP per run, so the per-IP daily limit starts at zero (DB mode persists across runs).
const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}, 10.0.0.1`;
const daytime = '2026-11-16T17:00:00Z';

async function scan(body, { contentType = 'text/csv', clientIp = ip } = {}) {
  const res = await fetch(`${base}/api/scan?debug_now=${daytime}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-forwarded-for': clientIp },
    body,
  });
  return { status: res.status, text: await res.text() };
}

// 60 data rows: 50 unique valid, 5 invalid, 5 duplicates; a consent column.
const phones = Array.from({ length: 50 }, (_, i) => `+1212555${String(6000 + i).padStart(4, '0')}`);
const lines = ['phone,consent_type,name'];
phones.forEach((p, i) => lines.push(`${p},${i % 2 ? 'express_written' : 'none'},"Lead, ${i}"`));
for (let i = 0; i < 5; i += 1) lines.push(`12${i},none,bad`);
for (let i = 0; i < 5; i += 1) lines.push(`${phones[i]},none,dup`);
const csv = lines.join('\n');

const first = await scan(csv);
let body = {};
try { body = JSON.parse(first.text); } catch { body = {}; }
check('scan of a 60-row list → 200', first.status === 200, `status=${first.status}`);
const t = body.totals || {};
check('totals add up (50 unique, 5 invalid, 5 duplicates, 50 screened)', t.rows === 60 && t.unique === 50 && t.invalid === 5 && t.duplicates === 5 && t.screened === 50,
  JSON.stringify(t));
const v = body.value || {};
check('value counts add up to the screened total', v.risky_actions_prevented + v.held_for_review + v.clear_to_call === 50, JSON.stringify(v));
check('risk breakdown is present', body.risk_breakdown && typeof body.risk_breakdown.litigator_hits?.count === 'number');
const leaked = phones.filter((p) => first.text.includes(p.slice(2)) || first.text.includes(p.slice(-7)));
check('response contains no uploaded phone numbers', leaked.length === 0, leaked.length ? `leaked ${leaked.length}` : '');
check('response has no row-level data', !('rows' in body) && !('results' in body));
check('dev-mock warning is shown', typeof body.data_warning === 'string' && body.data_warning.length > 0);
check('scan_id returned', typeof body.scan_id === 'string' && body.scan_id.length > 5);
check('privacy note and disclaimer present', /not stored/.test(body.privacy || '') && /not legal advice/i.test(body.disclaimer || ''));

if (!dbMode) {
  const stored = await fs.readFile(path.join(process.cwd(), '.data', 'public-scans.json'), 'utf8').catch(() => '');
  const storedLeak = phones.filter((p) => stored.includes(p.slice(-7)));
  check('stored scan summary contains no phone numbers', stored.length > 0 && storedLeak.length === 0, `bytes=${stored.length} leaked=${storedLeak.length}`);
  check('stored summary has no raw IP', stored.length > 0 && !stored.includes('203.0.113.'));
}

const noPhone = await scan('name,email\nA,a@x.com\n');
check('no phone column → 400 phone_column_not_found', noPhone.status === 400 && noPhone.text.includes('phone_column_not_found'));

const big = ['phone', ...Array.from({ length: 1001 }, (_, i) => `+1212555${String(i).padStart(4, '0')}`)].join('\n');
const tooBig = await scan(big);
check('1,001 rows → 413 too_many_rows', tooBig.status === 413 && tooBig.text.includes('too_many_rows'));

const form = new FormData();
form.append('file', new Blob(['phone\n+12125557001\n+12125557002\n'], { type: 'text/csv' }), 'list.csv');
const multi = await fetch(`${base}/api/scan`, { method: 'POST', headers: { 'x-forwarded-for': ip }, body: form });
const multiBody = await readJson(multi);
check('multipart file upload works', multi.status === 200 && multiBody.totals?.screened === 2, `status=${multi.status}`);

// Successful scans so far from this IP: 2 (the 60-row scan and the multipart one). Limit is 3/day.
const third = await scan('phone\n+12125557003\n');
check('third scan of the day → 200', third.status === 200, `status=${third.status}`);
const fourth = await scan('phone\n+12125557004\n');
check('fourth scan of the day → 429 scan_limit_reached', fourth.status === 429 && fourth.text.includes('scan_limit_reached'), `status=${fourth.status}`);
const otherIp = await scan('phone\n+12125557005\n', { clientIp: `198.51.100.${Math.floor(Math.random() * 250) + 1}` });
check('a different IP can still scan', otherIp.status === 200, `status=${otherIp.status}`);

async function lead(payload) {
  const res = await fetch(`${base}/api/scan/lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await readJson(res) };
}
check('lead without consent → 400', (await lead({ email: 'owner@agency.example', scan_id: body.scan_id })).status === 400);
check('lead with invalid email → 400', (await lead({ email: 'not-an-email', consent_to_contact: true })).status === 400);
const okLead = await lead({ email: 'owner@agency.example', scan_id: body.scan_id, consent_to_contact: true });
check('lead with consent → 201', okLead.status === 201 && !!okLead.body.lead_id, `status=${okLead.status}`);

const page = await fetch(`${base}/scan`);
const html = await page.text();
check('/scan page renders', page.status === 200 && html.includes('How risky is your call list?'));

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} scan checks passed`);
process.exitCode = failed.length ? 1 : 0;
