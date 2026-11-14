// Node 18+ regression check for invalid-key free-tier quota bypass.
const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
let failures = 0;
for (const key of ['fake_1', 'fake_2', 'fake_3', null]) {
  const label = key ? `Bearer ${key} rejected` : 'Anonymous request retains free-tier access';
  try {
    const response = await fetch(`${baseUrl}/api/v1/gate/phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ phone: '+14155550123' }),
      signal: AbortSignal.timeout(30000),
    });
    const ok = key ? response.status === 401 : [200, 429].includes(response.status);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label} (HTTP ${response.status})`);
    if (!ok) failures++;
  } catch (error) {
    console.log(`FAIL ${label}: ${error.message}`);
    failures++;
  }
}
try {
  const response = await fetch(`${baseUrl}/api/webhooks/vapi?assistant_id=test_asst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        type: 'assistant-request',
        call: { customer: { number: '+12125550148' } },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  const ok = response.status === 200 && response.headers.get('x-verifyone-decision') === 'ALLOW' && typeof payload?.assistantId === 'string';
  console.log(`${ok ? 'PASS' : 'FAIL'} Anonymous Vapi inbound caller is allowed (HTTP ${response.status})`);
  if (!ok) failures++;
} catch (error) {
  console.log(`FAIL Anonymous Vapi inbound caller is allowed: ${error.message}`);
  failures++;
}
try {
  const response = await fetch(`${baseUrl}/api/webhooks/retell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'call_inbound',
      call_inbound: {
        call_id: 'c1',
        from_number: '+12125550148',
        to_number: '+12125550199',
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  const ok = response.status === 200 && response.headers.get('x-verifyone-decision') === 'ALLOW' && payload?.call_inbound && typeof payload.call_inbound === 'object';
  console.log(`${ok ? 'PASS' : 'FAIL'} Anonymous Retell inbound caller is allowed (HTTP ${response.status})`);
  if (!ok) failures++;
} catch (error) {
  console.log(`FAIL Anonymous Retell inbound caller is allowed: ${error.message}`);
  failures++;
}
try {
  const response = await fetch(`${baseUrl}/api/webhooks/vapi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        type: 'assistant-request',
        call: { customer: { number: '+12125550148' } },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const ok = response.status === 200
    && response.headers.get('x-verifyone-reason') === 'assistant_id_missing'
    && response.headers.get('x-verifyone-evidence-id') === null;
  console.log(`${ok ? 'PASS' : 'FAIL'} Missing Vapi assistant_id is rejected before evidence is sealed (HTTP ${response.status})`);
  if (!ok) failures++;
} catch (error) {
  console.log(`FAIL Missing Vapi assistant_id is rejected before evidence is sealed: ${error.message}`);
  failures++;
}
process.exitCode = failures ? 1 : 0;
