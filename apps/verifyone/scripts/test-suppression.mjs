const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const dbMode = process.env.DB_MODE === '1';
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
async function readJson(res) {
  return res.json().catch(() => ({}));
}
async function signup() {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `test+sup-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com` }),
  });
  const body = await readJson(res);
  if (!body.api_key) throw new Error(`signup failed (${res.status})`);
  return body.api_key;
}

const key1 = await signup();
const key2 = await signup();

// Find an ALLOW candidate using deterministic dev mocks + daytime debug_now
const daytime = '2026-11-16T17:00:00Z'; // 12:00 ET
let allowPhone = '';
for (let i = 0; i < 40; i += 1) {
  const candidate = `+1212555${String(3000 + i).padStart(4, '0')}`;
  const r = await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: candidate, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
  });
  const b = await readJson(r);
  if (r.status === 200 && b.decision === 'ALLOW') {
    allowPhone = candidate;
    break;
  }
}
check('found ALLOW candidate with express_written consent', !!allowPhone, allowPhone);
if (!allowPhone) process.exit(1);

// 1. Outcome opt_out suppresses immediately even with express_written consent
const outRes = await fetch(`${base}/api/v1/gate/outcome`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: allowPhone, outcome: 'opt_out' }),
});
const outBody = await readJson(outRes);
check('outcome opt_out returns suppressed + evidence_id', outRes.status === 201 && outBody.suppressed === true && !!outBody.suppression_evidence_id);

const deniedGate = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: allowPhone, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
check('next gate call is DENY INTERNAL_DNC even with express_written', deniedGate.decision === 'DENY' && deniedGate.reason === 'INTERNAL_DNC' && deniedGate.checks?.internal_dnc?.listed === true);

// 2. Second account is NOT affected
const key2Gate = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key2}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: allowPhone, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
check('second account is not affected by first account suppression', key2Gate.decision === 'ALLOW');

// 3. POST /api/v1/suppression bulk add + GET check + idempotent duplicate add
const bulkPhone = `+1212555${String(3500).padStart(4, '0')}`;
const add1 = await fetch(`${base}/api/v1/suppression`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phones: [bulkPhone], reason: 'manual' }),
});
const add1Body = await readJson(add1);
const add2 = await fetch(`${base}/api/v1/suppression`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phones: [bulkPhone], reason: 'manual' }),
});
const add2Body = await readJson(add2);
const getCheck = await readJson(await fetch(`${base}/api/v1/suppression?phone=${encodeURIComponent(bulkPhone)}`, {
  headers: { Authorization: `Bearer ${key1}` },
}));
const addEvId = add1Body.results?.[0]?.evidence_id;
check(
  'POST /api/v1/suppression adds, duplicate is idempotent, GET check shows listed',
  add1.status === 201 && add1Body.added === 1 && add2Body.added === 0 && add2Body.already_suppressed === 1 && getCheck.listed === true && !!addEvId,
);

// 4. DELETE without reason -> 400; with reason -> next gate no longer INTERNAL_DNC
const delBad = await fetch(`${base}/api/v1/suppression`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: allowPhone, reason: '' }),
});
const delOk = await fetch(`${base}/api/v1/suppression`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: allowPhone, reason: 'customer re-consented' }),
});
const delOkBody = await readJson(delOk);
const afterDelGate = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: allowPhone, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
check(
  'DELETE requires reason (400) and unblocks on valid removal',
  delBad.status === 400 && delOk.status === 200 && !!delOkBody.evidence_id && afterDelGate.decision === 'ALLOW',
);

// 5. Evidence records exist for add and remove
const evAddRes = await fetch(`${base}/api/v1/gate/audit/${addEvId}`);
const evDelRes = await fetch(`${base}/api/v1/gate/audit/${delOkBody.evidence_id}`);
check('evidence records exist for add and remove', evAddRes.status === 200 && evDelRes.status === 200);

// 6. Bulk job containing suppressed number reports it under INTERNAL_DNC
const bulkCreate = await readJson(await fetch(`${base}/api/v1/bulk/jobs`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rows: [{ phone: bulkPhone, consent_type: 'express_written' }] }),
}));
for (let i = 0; i < 10; i += 1) {
  const st = await readJson(await fetch(`${base}/api/v1/bulk/jobs/${bulkCreate.job_id}`, { headers: { Authorization: `Bearer ${key1}` } }));
  if (st.status === 'completed') break;
  await fetch(`${base}/api/v1/bulk/jobs/${bulkCreate.job_id}/continue`, { method: 'POST', headers: { Authorization: `Bearer ${key1}` } });
}
const bulkReport = await readJson(await fetch(`${base}/api/v1/bulk/jobs/${bulkCreate.job_id}/report`, {
  headers: { Authorization: `Bearer ${key1}` },
}));
check(
  'bulk job reports suppressed number under INTERNAL_DNC',
  (bulkReport.value?.by_reason?.INTERNAL_DNC ?? 0) === 1 && (bulkReport.risk_breakdown?.internal_dnc?.count ?? 0) === 1,
);

// 7. Vapi inbound with suppressed caller -> Vapi deny payload (blocked_by_customer)
const vapiRes = await fetch(`${base}/api/webhooks/vapi?assistant_id=test_asst`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: { type: 'assistant-request', call: { customer: { number: bulkPhone } } } }),
});
const vapiInbound = await readJson(vapiRes);
check(
  'Vapi inbound with suppressed caller returns deny payload (blocked_by_customer)',
  vapiRes.headers.get('x-verifyone-decision') === 'DENY'
    && vapiRes.headers.get('x-verifyone-reason') === 'blocked_by_customer'
    && !!vapiInbound.error,
  `decision=${vapiRes.headers.get('x-verifyone-decision')}, reason=${vapiRes.headers.get('x-verifyone-reason')}`,
);

// 8. DB mode only: concurrent double-add -> exactly one active entry
if (dbMode) {
  const racePhone = `+1212555${String(3600).padStart(4, '0')}`;
  const [r1, r2] = await Promise.all([
    fetch(`${base}/api/v1/suppression`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones: [racePhone], reason: 'manual' }),
    }).then(readJson),
    fetch(`${base}/api/v1/suppression`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones: [racePhone], reason: 'manual' }),
    }).then(readJson),
  ]);
  const listAfter = await readJson(await fetch(`${base}/api/v1/suppression?search=${encodeURIComponent(racePhone)}`, {
    headers: { Authorization: `Bearer ${key1}` },
  }));
  check(
    'DB concurrent double-add produces exactly one active entry',
    (r1.added + r2.added) === 1 && (r1.already_suppressed + r2.already_suppressed) === 1 && (listAfter.items?.length ?? 0) === 1,
  );
}

if (checks.some((c) => !c.ok)) process.exitCode = 1;
