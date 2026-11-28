// Billing regression: signed Dodo webhooks are processed exactly once per delivery and per payment,
// credits land on the paying organization, and checkout carries the organization id.
// Runs in file mode (legacy email accounts) and Postgres mode (organizations: DB_MODE=1).
import crypto from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3200';
const MOCK = process.env.MOCK_URL || 'http://localhost:3999';
const SECRET = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
const DB = process.env.DB_MODE === '1';
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

function sign(id, ts, raw, secret = SECRET) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return 'v1,' + crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');
}

let seq = 0;
function uid(p) { seq += 1; return `${p}_${Date.now().toString(36)}_${seq}_${crypto.randomBytes(3).toString('hex')}`; }

async function webhook(evt, { id = uid('wh'), ts = Math.floor(Date.now() / 1000), signature } = {}) {
  const raw = JSON.stringify(evt);
  const headers = { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(ts) };
  if (signature !== null) headers['webhook-signature'] = signature ?? sign(id, ts, raw);
  const r = await req('/api/webhooks/dodo', { method: 'POST', headers, body: raw });
  return { ...r, id };
}

async function usage(key) {
  const r = await req('/api/v1/account/usage', { headers: { Authorization: `Bearer ${key}` } });
  return { plan: r.body?.plan, credits: r.body?.credits?.remaining };
}

async function signup(email) {
  for (let i = 0; i < 4; i += 1) {
    const r = await req('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, (Number(r.body.retry_after) || 15) * 1000)); continue; }
    return r.body.api_key;
  }
  return null;
}

async function lastCheckout() {
  const r = await fetch(MOCK + '/__checkouts').then((x) => x.json()).catch(() => ({ checkouts: [] }));
  return r.checkouts.at(-1);
}

if (!SECRET) { console.log('FAIL DODO_PAYMENTS_WEBHOOK_KEY not set for the test server'); process.exit(1); }
console.log(`== billing (${DB ? 'postgres' : 'file'} mode)`);

// ── Signature verification ──
const probe = { type: 'payment.succeeded', data: { payment_id: uid('pay') } };
ok((await webhook(probe, { signature: null })).status === 401, 'missing signature → 401');
ok((await webhook(probe, { signature: sign('other', Math.floor(Date.now() / 1000), '{}') })).status === 401, 'wrong signature → 401');
const stale = Math.floor(Date.now() / 1000) - 3600;
ok((await webhook(probe, { ts: stale, signature: undefined })).status === 401, 'timestamp an hour old → 401');
ok((await webhook(probe, { signature: sign('x', 1, '{}', 'whsec_' + crypto.randomBytes(24).toString('base64')) })).status === 401, 'signed with another secret → 401');

// ── Legacy email account (pre-organization) ──
const email = `${uid('billing')}@example.com`.toLowerCase();
const legacyKey = await signup(email);
ok(typeof legacyKey === 'string', 'legacy signup returns an API key');
if (legacyKey) {
  const before = await usage(legacyKey);
  const p1 = uid('pay');
  const evt = { type: 'payment.succeeded', data: { payment_id: p1, customer: { email }, metadata: { plan: 'LITE', email } } };
  const first = await webhook(evt);
  ok(first.status === 200 && first.body.status === 'applied' && first.body.credits === 5000, 'payment.succeeded → applied, 5,000 Lite credits', first.body);
  const after = await usage(legacyKey);
  ok(after.credits - before.credits === 5000 && after.plan === 'LITE', 'balance +5,000 and plan LITE', { before, after });

  const retry = await webhook(evt, { id: first.id });
  ok(retry.status === 200 && retry.body.status === 'duplicate_delivery', 'same webhook-id again → duplicate_delivery', retry.body);
  const renewedSame = await webhook({ type: 'subscription.renewed', data: { payment_id: p1, customer: { email }, metadata: { plan: 'LITE' } } });
  ok(renewedSame.body.status === 'duplicate_payment', 'another event with the same payment_id → duplicate_payment', renewedSame.body);
  ok((await usage(legacyKey)).credits === after.credits, 'duplicates added no credits');

  const unknown = await webhook({ type: 'payment.succeeded', data: { payment_id: uid('pay'), customer: { email: `${uid('nobody')}@example.com` }, metadata: { plan: 'LITE' } } });
  ok(unknown.body.status === 'unresolved' && !unknown.body.credits, 'payment for an unknown customer → unresolved, no credits', unknown.body);

  const v1Legacy = await req('/api/v1/billing/checkout', { method: 'POST', headers: { Authorization: `Bearer ${legacyKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'STARTER', email }) });
  ok(v1Legacy.status === 400 && v1Legacy.body.error === 'org_account_required', 'v1 checkout with a non-organization key → 400', v1Legacy.body);
}

// Legacy checkout (only without Clerk) reaches Dodo with the right product.
const legacyCheckout = await req('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, plan: 'LITE' }) });
const lc = await lastCheckout();
ok(legacyCheckout.status === 200 && typeof legacyCheckout.body.checkout_url === 'string', 'legacy checkout returns a checkout_url', legacyCheckout.body);
ok(lc?.body?.product_cart?.[0]?.product_id === 'prod_test_lite' && lc?.body?.metadata?.plan === 'LITE', 'checkout sent the Lite product and plan', lc?.body);
const badPlan = await req('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, plan: 'MEGA' }) });
ok(badPlan.status === 400, 'unknown plan → 400');

// ── Organizations (Postgres only) ──
if (DB) {
  const mkOrg = async (name) => (await req('/api/test/orgs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })).body;
  const a = await mkOrg('Billing Org A');
  ok(a?.org?.id && a?.api_key, 'test organization created');
  const authA = { Authorization: `Bearer ${a.api_key}`, 'Content-Type': 'application/json' };

  const co = await req('/api/v1/billing/checkout', { method: 'POST', headers: authA, body: JSON.stringify({ plan: 'STARTER', email: 'owner-a@example.com' }) });
  const last = await lastCheckout();
  ok(co.status === 200 && co.body.plan === 'STARTER', 'org checkout → checkout_url', co.body);
  ok(last?.body?.metadata?.org_id === a.org.id && last?.body?.product_cart?.[0]?.product_id === 'prod_test_starter', 'checkout metadata carries this org id', last?.body?.metadata);
  ok(last?.authorization_last4 === '0000', 'checkout used the Dodo API key');

  const sub = uid('sub');
  const before = await usage(a.api_key);
  const pay = await webhook({ type: 'payment.succeeded', data: { payment_id: uid('pay'), subscription_id: sub, product_cart: [{ product_id: 'prod_test_starter' }], metadata: { org_id: a.org.id } } });
  ok(pay.body.status === 'applied' && pay.body.orgId === a.org.id && pay.body.credits === 30000, 'payment → 30,000 credits to the paying org (plan from product id)', pay.body);
  const afterPay = await usage(a.api_key);
  ok(afterPay.credits - before.credits === 30000 && afterPay.plan === 'STARTER', 'org balance +30,000, plan STARTER', { before, afterPay });

  const active = await webhook({ type: 'subscription.active', data: { subscription_id: sub, payment_id: pay.body?.paymentId, metadata: { org_id: a.org.id, plan: 'STARTER' } } });
  ok(active.body.status === 'status_only' && !active.body.credits, 'subscription.active → linked, no extra credits', active.body);

  const again = await req('/api/v1/billing/checkout', { method: 'POST', headers: authA, body: JSON.stringify({ plan: 'GROWTH' }) });
  ok(again.status === 409 && again.body.error === 'subscription_exists', 'second checkout while subscribed → 409', again.body);

  const renew = await webhook({ type: 'subscription.renewed', data: { payment_id: uid('pay'), subscription_id: sub } });
  ok(renew.body.status === 'applied' && renew.body.orgId === a.org.id && renew.body.credits === 30000, 'renewal with only subscription_id → credited via the link', renew.body);

  // Two deliveries of the same payment at the same moment: exactly one grant.
  const racePay = uid('pay');
  const mk = () => webhook({ type: 'payment.succeeded', data: { payment_id: racePay, subscription_id: sub, metadata: { org_id: a.org.id, plan: 'STARTER' } } });
  const beforeRace = await usage(a.api_key);
  const race = await Promise.all([mk(), mk(), mk()]);
  const statuses = race.map((r) => r.body.status).sort();
  ok(race.every((r) => r.status === 200), 'concurrent deliveries all acknowledged (200)', race.map((r) => r.status));
  ok(statuses.filter((s) => s === 'applied').length === 1 && statuses.filter((s) => s === 'duplicate_payment').length === 2, 'exactly one applied, two duplicate_payment', statuses);
  ok((await usage(a.api_key)).credits - beforeRace.credits === 30000, 'race granted credits once');

  // Parked payment resolved later by the subscription link.
  const b = await mkOrg('Billing Org B');
  const subB = uid('sub');
  const parked = await webhook({ type: 'payment.succeeded', data: { payment_id: uid('pay'), subscription_id: subB, metadata: { plan: 'GROWTH' } } });
  ok(parked.body.status === 'unresolved', 'payment with no org yet → unresolved', parked.body);
  const beforeB = await usage(b.api_key);
  const link = await webhook({ type: 'subscription.active', data: { subscription_id: subB, metadata: { org_id: b.org.id, plan: 'GROWTH' } } });
  ok(link.body.resolved_pending === 1 && link.body.credits === 120000, 'subscription.active resolves the parked payment', link.body);
  ok((await usage(b.api_key)).credits - beforeB.credits === 120000, 'org B balance +120,000');
  const relink = await webhook({ type: 'subscription.updated', data: { subscription_id: subB, metadata: { org_id: b.org.id } } });
  ok(relink.body.resolved_pending === 0 && !relink.body.credits, 'later subscription events do not re-grant', relink.body);

  // Cancellation: back to FREE, credits kept, checkout allowed again.
  const beforeCancel = await usage(a.api_key);
  const cancel = await webhook({ type: 'subscription.cancelled', data: { subscription_id: sub } });
  const afterCancel = await usage(a.api_key);
  ok(cancel.body.status === 'status_only' && afterCancel.plan === 'FREE', 'subscription.cancelled → plan FREE', cancel.body);
  ok(afterCancel.credits === beforeCancel.credits, 'cancellation keeps remaining credits');
  const resub = await req('/api/v1/billing/checkout', { method: 'POST', headers: authA, body: JSON.stringify({ plan: 'LITE' }) });
  ok(resub.status === 200, 'checkout allowed again after cancellation (billing email remembered)', resub.body);
} else {
  console.log('  skip organization billing checks (file mode has no organizations)');
}

console.log(`\nbilling: ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
