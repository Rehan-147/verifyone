if (process.env.DB_MODE !== '1') {
  console.log('SKIP test-org-keys (file mode)');
  process.exit(0);
}

const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
async function readJson(res) {
  return res.json().catch(() => ({}));
}

// 1. Create Org A + Key 1
const orgARes = await fetch(`${base}/api/test/orgs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Org A', keyName: 'Key 1' }),
});
const orgA = await readJson(orgARes);
check('org A + key 1 created', orgARes.status === 201 && !!orgA.api_key && !!orgA.org?.id, `status=${orgARes.status}`);
if (!orgA.api_key) process.exit(1);

// 2. Gate call succeeds and debits Org A credits
const gate1 = await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${orgA.api_key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+12125550100', consent: { declared: true, type: 'express_written' } }),
});
const gate1Body = await readJson(gate1);
const usage1 = await readJson(await fetch(`${base}/api/v1/account/usage`, { headers: { Authorization: `Bearer ${orgA.api_key}` } }));
check('gate call with org key succeeds and debits org credits', gate1.status === 200 && !!gate1Body.evidence_id && usage1.credits?.remaining === 999, `remaining=${usage1.credits?.remaining}`);

// 3. Create Key 2 for same Org A
const key2Res = await fetch(`${base}/api/test/orgs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clerkOrgId: orgA.org.clerkOrgId, name: 'Org A', keyName: 'Key 2' }),
});
const key2 = await readJson(key2Res);
check('second key created for same org', key2Res.status === 201 && key2.org?.id === orgA.org.id && key2.api_key !== orgA.api_key);

// 4. Revoke Key 1
const revokeRes = await fetch(`${base}/api/test/orgs/keys/${orgA.key_id}/revoke`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orgId: orgA.org.id }),
});
check('key 1 revoked', revokeRes.status === 200);

// 5. Revoked Key 1 gets 401; Key 2 still works
const revokedGate = await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${orgA.api_key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+12125550100' }),
});
const key2Gate = await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key2.api_key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+12125550100', consent: { declared: true, type: 'express_written' } }),
});
check('revoked key gets 401 while second key still works', revokedGate.status === 401 && key2Gate.status === 200, `revoked=${revokedGate.status}, key2=${key2Gate.status}`);

// 6. Org A cannot read Org B bulk job (404)
const orgB = await readJson(await fetch(`${base}/api/test/orgs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Org B', keyName: 'Key B' }),
}));
const bulkB = await readJson(await fetch(`${base}/api/v1/bulk/jobs`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${orgB.api_key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rows: [{ phone: '+12125550101', consent_type: 'express_written' }] }),
}));
const crossRead = await fetch(`${base}/api/v1/bulk/jobs/${bulkB.job_id}`, {
  headers: { Authorization: `Bearer ${key2.api_key}` },
});
check('org A key cannot read org B bulk job (404)', !!bulkB.job_id && crossRead.status === 404, `status=${crossRead.status}`);

// 7. /api/auth/signup still works in dev
const signupRes = await fetch(`${base}/api/auth/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `test+org-${Date.now()}@example.com` }),
});
const signupBody = await readJson(signupRes);
check('/api/auth/signup works in dev', signupRes.status === 200 && !!signupBody.api_key);

if (checks.some((c) => !c.ok)) process.exitCode = 1;
