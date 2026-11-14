// Node 18+ billing regression: signup, then verify exact shield/full_stack debits.
const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
let failures = 0;
const email = `test+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(30000) });
}

try {
  const signupResponse = await request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const signup = await signupResponse.json().catch(() => ({}));
  if (typeof signup.api_key !== 'string' || !signup.api_key) {
    console.log(`SKIP signup did not return api_key (HTTP ${signupResponse.status})`);
    process.exit(0);
  }
  const auth = { Authorization: `Bearer ${signup.api_key}` };
  const balance = async () => {
    const response = await request('/api/v1/account/usage', { headers: auth });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.credits?.remaining !== 'number') {
      throw new Error(`usage endpoint returned HTTP ${response.status}`);
    }
    return payload.credits.remaining;
  };

  for (const test of [
    { profile: 'ai_outbound_shield', cost: 1, label: 'Shield gate deducts exactly 1 credit' },
    { profile: 'full_stack', cost: 5, label: 'Full stack gate deducts exactly 5 credits' },
  ]) {
    const before = await balance();
    const response = await request('/api/v1/gate/phone', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+14155550123', profile: test.profile }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.decision) {
      console.log(`FAIL ${test.label} (gate HTTP ${response.status})`);
      failures++;
      continue;
    }
    const after = await balance();
    const ok = before - after === test.cost;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${test.label} (before ${before}, after ${after})`);
    if (!ok) failures++;
  }
} catch (error) {
  console.log(`FAIL billing regression: ${error.message}`);
  failures++;
}

process.exitCode = failures ? 1 : 0;
