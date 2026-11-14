// DODO PAYMENTS — merchant of record (https://docs.dodopayments.com)
import crypto from 'crypto';
import { PLANS, type PlanName, normalizePlanKey } from './plans';

export { PLANS, type PlanName, normalizePlanKey };

export function dodoConfigured() {
  return !!process.env.DODO_PAYMENTS_API_KEY;
}

function dodoBase() {
  const env = (process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode').toLowerCase();
  return env.includes('live') ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com';
}

export function productIdForPlan(plan: PlanName): string | undefined {
  return process.env[`DODO_PRODUCT_${plan}`];
}

export function planForProductId(pid: string): PlanName | undefined {
  return (['STARTER', 'GROWTH', 'PRO'] as PlanName[]).find((p) => process.env[`DODO_PRODUCT_${p}`] === pid);
}

export async function createCheckoutSession(opts: { email: string; plan: PlanName; returnUrl: string }) {
  const productId = productIdForPlan(opts.plan);
  if (!productId) {
    throw new Error(`DODO_PRODUCT_${opts.plan} not set — create "${PLANS[opts.plan].name}" ($${PLANS[opts.plan].priceUsd}/mo) in Dodo and paste prod_... id`);
  }
  const r = await fetch(`${dodoBase()}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
    },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: opts.email },
      return_url: opts.returnUrl,
      metadata: {
        email: opts.email,
        plan: opts.plan,
        product: 'verifyone_shield',
        shield_checks: PLANS[opts.plan].shieldChecksMonthly,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`dodo_checkout_${r.status}: ${await r.text().catch(() => '')}`);
  const session = await r.json();
  return { checkout_url: session.checkout_url as string, session_id: session.session_id as string };
}

export function verifyWebhook(
  rawBody: string,
  headers: { 'webhook-id'?: string | null; 'webhook-signature'?: string | null; 'webhook-timestamp'?: string | null },
): { ok: boolean; reason?: string } {
  const secretEnv = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  const { 'webhook-id': id, 'webhook-signature': sigHeader, 'webhook-timestamp': ts } = headers;
  if (!secretEnv) return { ok: false, reason: 'webhook_key_not_configured' };
  if (!id || !sigHeader || !ts) return { ok: false, reason: 'missing_webhook_headers' };
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return { ok: false, reason: 'timestamp_out_of_tolerance' };
  let key: Buffer;
  try {
    key = Buffer.from(secretEnv.replace(/^whsec_/, ''), 'base64');
  } catch {
    key = Buffer.from(secretEnv);
  }
  const signedContent = `${id}.${ts}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');
  const provided = sigHeader.split(' ').map((s) => s.trim()).filter(Boolean);
  const ok = provided.some((entry) => {
    const [version, sig] = entry.split(',');
    return version === 'v1' && !!sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
  return ok ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}
