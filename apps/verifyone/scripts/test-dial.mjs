const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const mock = (process.env.MOCK_URL || 'http://localhost:3999').replace(/\/$/, '');
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
async function json(response) {
  return response.json().catch(() => ({}));
}
async function platformCalls(platform) {
  const response = await fetch(`${mock}/__calls`);
  const body = await json(response);
  return (body.calls || []).filter((call) => call.platform === platform);
}
async function balance(key) {
  const response = await fetch(`${base}/api/v1/account/usage`, { headers: { Authorization: `Bearer ${key}` } });
  const data = await json(response);
  return data.credits?.remaining;
}

const email = `test+${Date.now()}@example.com`;
const signupResponse = await fetch(`${base}/api/auth/signup`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
});
const signup = await json(signupResponse);
if (typeof signup.api_key !== 'string') {
  console.log(`SKIP signup did not return api_key (HTTP ${signupResponse.status})`);
  process.exit(0);
}
const key = signup.api_key;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const debugNow = '2026-11-13T15:00:00Z';
let allowedPhone = null;
for (let i = 0; i < 80; i += 1) {
  const phone = `+1212555${String(1000 + i).padStart(4, '0')}`;
  const response = await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST', headers,
    body: JSON.stringify({ phone, consent: { declared: true, type: 'express_written' }, debug_now: debugNow }),
  });
  const result = await json(response);
  if (result.decision === 'ALLOW') { allowedPhone = phone; break; }
}
check('candidate found with an ALLOW gate decision', !!allowedPhone);

for (const platform of ['vapi', 'retell']) {
  const fakeKey = `fake_${platform}_credential_1234`;
  const defaults = platform === 'vapi'
    ? { assistant_id: 'asst_mock', phone_number_id: 'pn_mock' }
    : { agent_id: 'agent_mock', from_number: '+14155550100' };
  const credentialUrl = `${base}/api/v1/platforms/${platform}/credentials`;
  const stored = await fetch(credentialUrl, {
    method: 'PUT', headers, body: JSON.stringify({ api_key: fakeKey, defaults }),
  });
  check(`${platform} credential saved`, stored.status === 200);

  const credentialGet = await fetch(credentialUrl, { headers: { Authorization: `Bearer ${key}` } });
  const credentialData = await json(credentialGet);
  const fullKeyHidden = !JSON.stringify(credentialData).includes(fakeKey) && credentialData.key_last4 === fakeKey.slice(-4);
  check(`${platform} GET hides full key`, credentialGet.ok && fullKeyHidden);

  const beforeDeniedCalls = (await platformCalls(platform)).length;
  const denied = await fetch(`${base}/api/v1/dial/${platform}`, {
    method: 'POST', headers: { ...headers, 'Idempotency-Key': `deny-${platform}-${Date.now()}` },
    body: JSON.stringify({ phone: '+12120000000', consent: { declared: true, type: 'express_written' }, debug_now: debugNow, [platform]: defaults }),
  });
  const deniedBody = await json(denied);
  const afterDeniedCalls = (await platformCalls(platform)).length;
  check(`${platform} DENY never reaches platform`, denied.status === 200 && deniedBody.dialed === false && afterDeniedCalls === beforeDeniedCalls, `decision=${deniedBody.decision}`);

  if (!allowedPhone) {
    check(`${platform} ALLOW dial placed once`, false, 'no ALLOW candidate found');
    continue;
  }
  const callBody = { phone: allowedPhone, consent: { declared: true, type: 'express_written' }, debug_now: debugNow, [platform]: defaults };
  const idempotency = `allow-${platform}-${Date.now()}`;
  const callsBefore = (await platformCalls(platform)).length;
  const first = await fetch(`${base}/api/v1/dial/${platform}`, {
    method: 'POST', headers: { ...headers, 'Idempotency-Key': idempotency }, body: JSON.stringify(callBody),
  });
  const firstBody = await json(first);
  const afterFirst = (await platformCalls(platform)).length;
  check(`${platform} ALLOW dial placed once`, first.status === 200 && firstBody.dialed === true && afterFirst === callsBefore + 1);

  const balanceAfterFirst = await balance(key);
  const replay = await fetch(`${base}/api/v1/dial/${platform}`, {
    method: 'POST', headers: { ...headers, 'Idempotency-Key': idempotency }, body: JSON.stringify(callBody),
  });
  const replayBody = await json(replay);
  const balanceAfterReplay = await balance(key);
  const afterReplay = (await platformCalls(platform)).length;
  check(`${platform} idempotent replay has no second call or charge`, replay.status === first.status && replayBody.call_id === firstBody.call_id && afterReplay === afterFirst && balanceAfterReplay === balanceAfterFirst);

  const missingIdem = await fetch(`${base}/api/v1/dial/${platform}`, {
    method: 'POST', headers, body: JSON.stringify(callBody),
  });
  check(`${platform} missing Idempotency-Key rejected`, missingIdem.status === 400);

  const removed = await fetch(credentialUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } });
  const disconnected = await fetch(`${base}/api/v1/dial/${platform}`, {
    method: 'POST', headers: { ...headers, 'Idempotency-Key': `disconnected-${platform}-${Date.now()}` }, body: JSON.stringify(callBody),
  });
  const disconnectedBody = await json(disconnected);
  check(`${platform} deleted credential blocks dialing`, removed.ok && disconnected.status === 400 && disconnectedBody.error === 'platform_not_connected');
}

if (checks.some((item) => !item.ok)) process.exitCode = 1;
