// Call-frequency caps: Florida's 3 calls / 24 h (Fla. Stat. § 501.616(6)(b)) and customer caps.
// Runs in file mode and DB mode; org-cap checks run in DB mode only.
const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const dbMode = process.env.DB_MODE === '1';
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const readJson = (res) => res.json().catch(() => ({}));
const daytime = '2026-11-16T17:00:00Z'; // 12:00 Eastern
const consent = { declared: true, type: 'express_written' };

async function signup(tag) {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `test+freq-${tag}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com` }),
  });
  const body = await readJson(res);
  if (!body.api_key) throw new Error(`signup failed (${res.status})`);
  return body.api_key;
}

async function gate(key, phone, extra = {}) {
  const res = await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, consent, debug_now: daytime, ...extra }),
  });
  return { status: res.status, body: await readJson(res) };
}

// Pre-checks (count_attempt:false) never record attempts, so searching for candidates is free.
async function findAllow(key, prefix, start) {
  for (let i = 0; i < 60; i += 1) {
    const phone = `${prefix}${String(start + i).padStart(4, '0')}`;
    const r = await gate(key, phone, { count_attempt: false });
    if (r.status === 200 && r.body.decision === 'ALLOW') return phone;
  }
  return '';
}

const key1 = await signup('a');
const key2 = await signup('b');

// ── Florida state cap ────────────────────────────────────────────────────────
const fl = await findAllow(key1, '+1305555', 4100);
check('found a Florida (305) number that is ALLOW in daytime', !!fl, fl);
if (!fl) process.exit(1);

const pre = await gate(key1, fl, { count_attempt: false });
check('pre-check does not record an attempt', pre.body.decision === 'ALLOW' && pre.body.checks?.frequency?.attempt_recorded !== true && pre.body.checks?.frequency?.attempts_24h === 0,
  JSON.stringify(pre.body.checks?.frequency));
check('Florida limit is reported (3, state:FL, § 501.616(6)(b))',
  pre.body.checks?.frequency?.limit === 3 && pre.body.checks?.frequency?.source === 'state:FL' && /501\.616\(6\)\(b\)/.test(pre.body.checks?.frequency?.citation || ''));

for (let n = 1; n <= 3; n += 1) {
  const r = await gate(key1, fl);
  check(`call ${n} of 3 → ALLOW and recorded`, r.body.decision === 'ALLOW' && r.body.checks?.frequency?.attempt_recorded === true && r.body.checks?.frequency?.attempts_24h === n - 1,
    `decision=${r.body.decision} attempts_before=${r.body.checks?.frequency?.attempts_24h}`);
}
const fourth = await gate(key1, fl);
check('4th call within 24 h → DENY STATE_FREQUENCY_CAP', fourth.body.decision === 'DENY' && fourth.body.reason === 'STATE_FREQUENCY_CAP',
  `decision=${fourth.body.decision} reason=${fourth.body.reason}`);
check('cap DENY reports 3 attempts and exceeded', fourth.body.checks?.frequency?.attempts_24h === 3 && fourth.body.checks?.frequency?.exceeded === true);
const capPre = await gate(key1, fl, { count_attempt: false });
check('a pre-check on a capped number is also DENY', capPre.body.decision === 'DENY' && capPre.body.reason === 'STATE_FREQUENCY_CAP');

const other = await gate(key2, fl);
check('another customer calling the same number is not affected', other.body.decision === 'ALLOW', `decision=${other.body.decision}`);

// Rolling window: once the attempts are older than 24 h the number can be called again.
const back = await fetch(`${base}/api/test/frequency`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'backdate', phone: fl, hours: 25 }),
});
const backBody = await readJson(back);
check('test hook backdated the 3 attempts', back.status === 200 && backBody.changed === 3, `status=${back.status} changed=${backBody.changed}`);
const afterWindow = await gate(key1, fl);
check('after 24 h the number can be called again', afterWindow.body.decision === 'ALLOW' && afterWindow.body.checks?.frequency?.attempts_24h === 0,
  `decision=${afterWindow.body.decision} attempts=${afterWindow.body.checks?.frequency?.attempts_24h}`);

// ── No cap outside capped states (and no account cap) ───────────────────────
const ny = await findAllow(key1, '+1212555', 4200);
check('found a New York (212) number that is ALLOW', !!ny, ny);
let nyAllOk = !!ny;
for (let n = 1; n <= 5 && ny; n += 1) {
  const r = await gate(key1, ny);
  if (r.body.decision !== 'ALLOW') nyAllOk = false;
}
check('5 calls to a non-capped state are all ALLOW (no state rule, no account cap)', nyAllOk);

// ── Concurrency: 6 parallel calls to a fresh Florida number → exactly 3 ALLOW ─
const key3 = await signup('c');
const fl2 = await findAllow(key3, '+1305555', 4300);
check('found a second Florida number', !!fl2, fl2);
if (fl2) {
  const results = await Promise.all(Array.from({ length: 6 }, () => gate(key3, fl2)));
  const allows = results.filter((r) => r.body.decision === 'ALLOW').length;
  const caps = results.filter((r) => r.body.reason === 'STATE_FREQUENCY_CAP').length;
  check('6 concurrent calls → exactly 3 ALLOW and 3 STATE_FREQUENCY_CAP', allows === 3 && caps === 3, `allow=${allows} cap=${caps}`);
}

// ── MCP check_call_allowed counts attempts too ──────────────────────────────
const key4 = await signup('d');
const fl3 = await findAllow(key4, '+1305555', 4400);
check('found a third Florida number', !!fl3, fl3);
if (fl3) {
  const decisions = [];
  for (let n = 0; n < 4; n += 1) {
    const res = await fetch(`${base}/api/mcp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key4}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'tools/call', params: { name: 'check_call_allowed', arguments: { phone: fl3, consent } } }),
    });
    const body = await readJson(res);
    let parsed = {};
    try { parsed = JSON.parse(body.content?.[0]?.text || '{}'); } catch { parsed = {}; }
    decisions.push(parsed.reason || parsed.decision || `http_${res.status}`);
  }
  // MCP has no debug_now, so it uses the real clock: quiet hours may legitimately apply.
  const quietNow = decisions.every((d) => d === 'STATE_QUIET_HOURS' || d === 'QUIET_HOURS');
  check('MCP: 3 allowed then STATE_FREQUENCY_CAP (or quiet hours right now)',
    quietNow || (decisions.slice(0, 3).every((d) => d === 'PASS' || d === 'ACTIVE_HLR') && decisions[3] === 'STATE_FREQUENCY_CAP'),
    decisions.join(','));
}

// ── Bulk audits never record attempts ───────────────────────────────────────
const key5 = await signup('e');
const fl4 = await findAllow(key5, '+1305555', 4500);
if (fl4) {
  const job = await fetch(`${base}/api/v1/bulk/jobs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key5}`, 'Content-Type': 'text/csv' },
    body: `phone,consent_type\n${fl4},express_written\n${fl4.slice(0, -1)}9,express_written\n`,
  });
  const jobBody = await readJson(job);
  let status = jobBody.status;
  for (let i = 0; i < 10 && status !== 'completed' && jobBody.job_id; i += 1) {
    const c = await fetch(`${base}/api/v1/bulk/jobs/${jobBody.job_id}/continue`, { method: 'POST', headers: { Authorization: `Bearer ${key5}` } });
    status = (await readJson(c)).status;
  }
  const after = await gate(key5, fl4, { count_attempt: false });
  check('a bulk audit does not record call attempts', status === 'completed' && after.body.checks?.frequency?.attempts_24h === 0,
    `job=${status} attempts=${after.body.checks?.frequency?.attempts_24h}`);
}

// ── Customer account cap (organizations, DB mode) ───────────────────────────
if (!dbMode) {
  console.log('SKIP account-cap checks (file mode: organization accounts need Postgres)');
} else {
  const legacy = await fetch(`${base}/api/v1/settings/frequency`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_cap_24h: 2 }),
  });
  check('non-organization account cannot set a cap → 400 org_account_required', legacy.status === 400 && (await readJson(legacy)).error === 'org_account_required');

  const orgRes = await fetch(`${base}/api/test/orgs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Freq Org', keyName: 'freq key' }),
  });
  const org = await readJson(orgRes);
  check('test organization created', orgRes.status === 201 && !!org.api_key);
  const ok = org.api_key;
  const put = (v) => fetch(`${base}/api/v1/settings/frequency`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${ok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_cap_24h: v }),
  });

  check('cap 0 → 400', (await put(0)).status === 400);
  check('cap 51 → 400', (await put(51)).status === 400);
  check('cap "3" (string) → 400', (await put('3')).status === 400);
  const set2 = await put(2);
  check('cap 2 → 200', set2.status === 200 && (await readJson(set2)).call_cap_24h === 2);
  const get = await fetch(`${base}/api/v1/settings/frequency`, { headers: { Authorization: `Bearer ${ok}` } });
  const getBody = await readJson(get);
  check('GET shows cap 2 and the Florida state rule', getBody.call_cap_24h === 2 && getBody.state_rules?.some((r) => r.state === 'FL' && r.max_calls === 3));

  const orgNy = await findAllow(ok, '+1212555', 4600);
  check('found a 212 number for the org', !!orgNy, orgNy);
  if (orgNy) {
    const a = await gate(ok, orgNy);
    const b = await gate(ok, orgNy);
    const c = await gate(ok, orgNy);
    check('account cap 2: two ALLOW then FREQUENCY_CAP', a.body.decision === 'ALLOW' && b.body.decision === 'ALLOW' && c.body.decision === 'DENY' && c.body.reason === 'FREQUENCY_CAP',
      `${a.body.decision},${b.body.decision},${c.body.reason}`);
    check('account-cap DENY names the org cap as source', c.body.checks?.frequency?.source === 'org' && c.body.checks?.frequency?.limit === 2);
    const clear = await put(null);
    check('cap null → 200 (removed)', clear.status === 200 && (await readJson(clear)).call_cap_24h === null);
    const d = await gate(ok, orgNy);
    check('after removing the cap the number can be called again', d.body.decision === 'ALLOW', d.body.decision);
  }

  // A looser account cap cannot raise the Florida limit.
  await put(10);
  const orgFl = await findAllow(ok, '+1305555', 4700);
  if (orgFl) {
    for (let n = 0; n < 3; n += 1) await gate(ok, orgFl);
    const r = await gate(ok, orgFl);
    check('account cap 10 does not raise Florida\'s 3: 4th → STATE_FREQUENCY_CAP', r.body.reason === 'STATE_FREQUENCY_CAP' && r.body.checks?.frequency?.source === 'state:FL', `${r.body.reason} source=${r.body.checks?.frequency?.source}`);
  }
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} frequency checks passed`);
process.exitCode = failed.length ? 1 : 0;
