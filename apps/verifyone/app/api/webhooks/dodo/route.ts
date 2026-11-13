export const dynamic = 'force-dynamic';

// POST /api/webhooks/dodo — signature-verified (Standard Webhooks scheme).
// Grants plan credits on: payment.succeeded, subscription.active, subscription.renewed.
// Downgrades on subscription.cancelled / subscription.expired.
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, planForProductId } from '../../../../lib/dodo';
import { PLANS, type PlanName } from '../../../../lib/plans';
import { applyPlan } from '../../../../lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const verdict = verifyWebhook(raw, {
    'webhook-id': req.headers.get('webhook-id'),
    'webhook-signature': req.headers.get('webhook-signature'),
    'webhook-timestamp': req.headers.get('webhook-timestamp'),
  });
  if (!verdict.ok) {
    return NextResponse.json({ error: 'invalid_signature', reason: verdict.reason }, { status: 401 });
  }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const type: string = evt?.type || '';
  const data = evt?.data ?? {};

  const email: string | undefined = data?.customer?.email || data?.metadata?.email;
  const productIds: string[] = [
    ...(Array.isArray(data?.product_cart) ? data.product_cart.map((p: any) => p?.product_id) : []),
    data?.product_id,
  ].filter(Boolean);

  let plan: PlanName | undefined;
  for (const pid of productIds) { const p = planForProductId(pid); if (p) plan = p; }
  if (!plan && data?.metadata?.plan && (data.metadata.plan.toUpperCase() in PLANS)) {
    plan = String(data.metadata.plan).toUpperCase() as PlanName;
  }

  let action = 'ignored';
  if (email && plan && (type === 'payment.succeeded' || type === 'subscription.active' || type === 'subscription.renewed')) {
    const acc = await applyPlan(email, plan, PLANS[plan].credits);
    action = `granted_${plan}_${PLANS[plan].credits}_credits`;
    // Local audit trail of money events (prod: Prisma PaymentLog table)
    try {
      await fs.mkdir(path.join(process.cwd(), '.data'), { recursive: true });
      await fs.appendFile(path.join(process.cwd(), '.data', 'payments.jsonl'),
        JSON.stringify({ at: new Date().toISOString(), type, email, plan, credits: PLANS[plan].credits, payment_id: data?.payment_id || data?.subscription_id }) + '\n');
    } catch {}
    return NextResponse.json({ received: true, action, email, plan, credits_left: acc.credits });
  }

  if (email && (type === 'subscription.cancelled' || type === 'subscription.expired')) {
    const acc = await applyPlan(email, 'FREE', 0);
    action = 'downgraded_to_free';
    return NextResponse.json({ received: true, action, credits_left: acc.credits });
  }

  return NextResponse.json({ received: true, action, type });
}
