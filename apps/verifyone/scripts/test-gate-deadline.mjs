// Gate deadline regression: ordinary slowness (e.g. a hosted database round trip) must not turn a
// valid call into GATE_UNAVAILABLE, but a gate that never finishes must still fail closed.
// Uses the test-only debug_delay_ms hook (VERIFYONE_TEST_HOOKS=1, non-production).
const BASE = process.env.BASE_URL || 'http://localhost:3200';
let failures = 0;
let checks = 0;
function ok(cond, label, extra) {
  checks += 1;
  if (cond) console.log(`  ok   ${label}`);
  else { failures += 1; console.log(`  FAIL ${label}${extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`); }
}
async function req(path, opts = {}) {
  // Generous timeout: the first request to a route includes its dev-server compile.
  const r = await fetch(BASE + path, { ...opts, signal: AbortSignal.timeout(120000) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

let key = null;
for (let i = 0; i < 4 && !key; i += 1) {
  const r = await req('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `deadline_${Date.now()}_${i}@example.com` }) });
  if (r.status === 429) await new Promise((res) => setTimeout(res, (Number(r.body.retry_after) || 15) * 1000));
  else key = r.body.api_key;
}
if (!key) { console.log('FAIL signup did not return an API key'); process.exit(1); }
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const balance = async () => (await req('/api/v1/account/usage', { headers })).body?.credits?.remaining;
const gate = (extra) => req('/api/v1/gate/phone', { method: 'POST', headers, body: JSON.stringify({ phone: '+14155550123', count_attempt: false, ...extra }) });

console.log('== gate deadline');
await gate({}); // warm the route so compile time does not count

let before = await balance();
const slow = await gate({ debug_delay_ms: 400 });
ok(slow.status === 200 && slow.body.reason !== 'GATE_UNAVAILABLE', 'shield 400 ms slower than its 95 ms target still decides normally', slow.body.reason);
ok(slow.body.latency_budget_ms === 95, 'response still reports the 95 ms latency target', slow.body.latency_budget_ms);
ok(before - (await balance()) === 1, 'slow-but-finished check is metered (1 credit)');

before = await balance();
const hung = await gate({ debug_delay_ms: 3500 });
ok(hung.status === 200 && hung.body.decision === 'DENY' && hung.body.reason === 'GATE_UNAVAILABLE', 'gate past the 2.5 s deadline fails closed (DENY GATE_UNAVAILABLE)', { decision: hung.body.decision, reason: hung.body.reason });
ok((await balance()) === before, 'fail-closed timeout is not charged');

const fullSlow = await gate({ profile: 'full_stack', debug_delay_ms: 1200 });
ok(fullSlow.status === 200 && fullSlow.body.reason !== 'GATE_UNAVAILABLE', 'full_stack 1.2 s (past its 800 ms target) still decides normally', fullSlow.body.reason);

console.log(`\ngate deadline: ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
