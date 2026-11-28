// Dodo Payments webhook processing — exactly-once credits.
//
// Guarantees:
//   1. Each webhook delivery (webhook-id) is processed once; Dodo retries are acknowledged as duplicates.
//   2. Credits are granted at most once per Dodo payment (payment_id), no matter how many events
//      mention it. A new subscription fires payment.succeeded AND subscription.active; a renewal
//      may fire payment.succeeded AND subscription.renewed — only the first one with the payment_id
//      grants credits (PaymentEvent.grantPaymentId is unique).
//   3. A payment that cannot be tied to an organization yet is parked as 'unresolved' (no credits)
//      and granted later when a subscription event links the subscription to an organization.
// Everything for one event happens in one database transaction, so a failure leaves no partial
// grant and Dodo's retry processes it again.
import fs from 'fs/promises';
import path from 'path';
import { dbEnabled, prisma, TX_OPTIONS } from './db';
import { PLANS, normalizePlanKey, type PlanName } from './plans';
import { planForProductId } from './dodo';
import { applyPlan, findAccountByEmail } from './auth';

type Json = Record<string, any>;

export type BillingResult = {
  status: 'applied' | 'unresolved' | 'duplicate_delivery' | 'duplicate_payment' | 'status_only' | 'ignored';
  credits?: number;
  orgId?: string | null;
  plan?: string | null;
  resolved_pending?: number;
};

const GRANT_EVENTS = new Set(['payment.succeeded', 'subscription.renewed']);
const LINK_EVENTS = new Set(['subscription.active', 'subscription.updated', 'subscription.plan_changed', 'subscription.renewed']);
const END_EVENTS = new Set(['subscription.cancelled', 'subscription.expired']);

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function extract(evt: Json) {
  const data: Json = evt?.data ?? {};
  const meta: Json = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
  const customerMeta: Json = (data.customer?.metadata && typeof data.customer.metadata === 'object') ? data.customer.metadata : {};
  const productIds = [
    ...(Array.isArray(data.product_cart) ? data.product_cart.map((p: Json) => p?.product_id) : []),
    data.product_id,
  ].filter((x): x is string => typeof x === 'string' && !!x);
  let plan: PlanName | null = normalizePlanKey(String(meta.plan ?? customerMeta.plan ?? ''));
  if (!plan) for (const pid of productIds) { const p = planForProductId(pid); if (p) { plan = p; break; } }
  return {
    type: String(evt?.type ?? ''),
    paymentId: str(data.payment_id),
    subscriptionId: str(data.subscription_id),
    orgId: str(meta.org_id) ?? str(customerMeta.org_id),
    email: (str(data.customer?.email) ?? str(meta.email))?.toLowerCase() ?? null,
    plan,
  };
}

function isUniqueViolation(e: unknown, field?: string): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== 'P2002') return false;
  if (!field) return true;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.some((t) => String(t).includes(field)) : String(target ?? '').includes(field);
}

export async function processDodoEvent(webhookId: string, evt: Json): Promise<BillingResult> {
  if (!dbEnabled()) {
    if (process.env.NODE_ENV === 'production') throw new Error('persistence_unavailable');
    return processFileMode(webhookId, evt);
  }
  if (await prisma.paymentEvent.findUnique({ where: { webhookId }, select: { id: true } })) {
    return { status: 'duplicate_delivery' };
  }
  try {
    return await prisma.$transaction((tx) => applyInTx(tx, webhookId, evt), TX_OPTIONS);
  } catch (e) {
    if (isUniqueViolation(e, 'webhookId')) return { status: 'duplicate_delivery' };
    if (isUniqueViolation(e, 'grantPaymentId')) {
      // A concurrent event already granted this payment: record this delivery without credits.
      const x = extract(evt);
      try {
        await prisma.paymentEvent.create({
          data: { webhookId, type: x.type, paymentId: x.paymentId, subscriptionId: x.subscriptionId, orgId: x.orgId, email: x.email, plan: x.plan, status: 'duplicate_payment' },
        });
      } catch (e2) {
        if (isUniqueViolation(e2, 'webhookId')) return { status: 'duplicate_delivery' };
        throw e2;
      }
      return { status: 'duplicate_payment' };
    }
    throw e;
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function grantToOrg(tx: Tx, orgId: string, plan: PlanName, paymentId: string, subscriptionId: string | null) {
  const credits = PLANS[plan].credits;
  await tx.organization.update({ where: { id: orgId }, data: { credits: { increment: credits }, plan } });
  await tx.creditLedger.create({ data: { orgId, amount: credits, reason: `dodo:payment:${paymentId}` } });
  if (subscriptionId) {
    // Link the subscription if the org has none yet (never steal another org's link).
    await tx.organization.updateMany({ where: { id: orgId, dodoSubscriptionId: null }, data: { dodoSubscriptionId: subscriptionId } });
  }
  return credits;
}

async function applyInTx(tx: Tx, webhookId: string, evt: Json): Promise<BillingResult> {
  const x = extract(evt);
  const base = { webhookId, type: x.type, paymentId: x.paymentId, subscriptionId: x.subscriptionId, email: x.email };

  // Resolve the organization: explicit metadata first, then the subscription link.
  let org = x.orgId ? await tx.organization.findUnique({ where: { id: x.orgId } }) : null;
  if (!org && x.subscriptionId) org = await tx.organization.findUnique({ where: { dodoSubscriptionId: x.subscriptionId } });
  const orgPlan = org && org.plan in PLANS ? (org.plan as PlanName) : null;
  const plan: PlanName | null = x.plan ?? orgPlan;

  // ── Payment for a billing period: grant credits once per payment_id ──
  if (GRANT_EVENTS.has(x.type) && x.paymentId) {
    if (org && plan && !org.disabledAt) {
      const credits = await grantToOrg(tx, org.id, plan, x.paymentId, x.subscriptionId);
      await tx.paymentEvent.create({ data: { ...base, orgId: org.id, plan, credits, grantPaymentId: x.paymentId, status: 'applied' } });
      return { status: 'applied', credits, orgId: org.id, plan };
    }
    // Legacy (pre-organization) account by email, only if it already exists.
    if (!org && x.email && plan) {
      const user = await tx.user.findUnique({ where: { email: x.email } });
      if (user) {
        const credits = PLANS[plan].credits;
        await tx.user.update({ where: { id: user.id }, data: { credits: { increment: credits }, plan } });
        await tx.creditLedger.create({ data: { userId: user.id, amount: credits, reason: `dodo:payment:${x.paymentId}` } });
        await tx.paymentEvent.create({ data: { ...base, plan, credits, grantPaymentId: x.paymentId, status: 'applied' } });
        return { status: 'applied', credits, orgId: null, plan };
      }
    }
    // Cannot attribute yet: park it. A later subscription event resolves it.
    await tx.paymentEvent.create({ data: { ...base, orgId: org?.id ?? null, plan, status: 'unresolved' } });
    return { status: 'unresolved', orgId: org?.id ?? null, plan };
  }

  // ── Subscription became active / changed: link it and resolve parked payments ──
  if (LINK_EVENTS.has(x.type) && x.subscriptionId && org) {
    await tx.organization.updateMany({ where: { id: org.id, dodoSubscriptionId: null }, data: { dodoSubscriptionId: x.subscriptionId } });
    if (x.plan) await tx.organization.update({ where: { id: org.id }, data: { plan: x.plan } });
    const pending = await tx.paymentEvent.findMany({ where: { subscriptionId: x.subscriptionId, status: 'unresolved', paymentId: { not: null } } });
    let resolved = 0;
    let credits = 0;
    for (const p of pending) {
      const pPlan = (p.plan && p.plan in PLANS ? (p.plan as PlanName) : null) ?? x.plan ?? orgPlan;
      if (!pPlan || !p.paymentId) continue;
      // Already granted by another delivery: close the parked row without credits.
      if (await tx.paymentEvent.findUnique({ where: { grantPaymentId: p.paymentId }, select: { id: true } })) {
        await tx.paymentEvent.update({ where: { id: p.id }, data: { status: 'duplicate_payment', resolvedAt: new Date() } });
        continue;
      }
      // grantPaymentId is unique: under a true race the transaction fails and Dodo retries it.
      credits += await grantToOrg(tx, org.id, pPlan, p.paymentId, x.subscriptionId);
      await tx.paymentEvent.update({ where: { id: p.id }, data: { status: 'applied', orgId: org.id, plan: pPlan, credits: PLANS[pPlan].credits, grantPaymentId: p.paymentId, resolvedAt: new Date() } });
      resolved += 1;
    }
    await tx.paymentEvent.create({ data: { ...base, orgId: org.id, plan: x.plan, status: 'status_only' } });
    return { status: 'status_only', orgId: org.id, plan: x.plan, resolved_pending: resolved, credits };
  }

  // ── Subscription ended: back to FREE (remaining credits stay usable) ──
  if (END_EVENTS.has(x.type) && org) {
    await tx.organization.update({
      where: { id: org.id },
      data: { plan: 'FREE', ...(x.subscriptionId && org.dodoSubscriptionId === x.subscriptionId ? { dodoSubscriptionId: null } : {}) },
    });
    await tx.paymentEvent.create({ data: { ...base, orgId: org.id, status: 'status_only' } });
    return { status: 'status_only', orgId: org.id, plan: 'FREE' };
  }

  await tx.paymentEvent.create({ data: { ...base, orgId: org?.id ?? null, plan: x.plan, status: 'ignored' } });
  return { status: 'ignored', orgId: org?.id ?? null };
}

// ── File mode (local development without Postgres): legacy email accounts only ──
const EVENTS_FILE = path.join(process.cwd(), '.data', 'payment-events.json');
let fileQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = fileQueue.then(work, work);
  fileQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function processFileMode(webhookId: string, evt: Json): Promise<BillingResult> {
  return serialize(async () => {
    let rows: Json[] = [];
    try { rows = JSON.parse(await fs.readFile(EVENTS_FILE, 'utf8')); } catch { rows = []; }
    if (rows.some((r) => r.webhookId === webhookId)) return { status: 'duplicate_delivery' as const };
    const x = extract(evt);
    let result: BillingResult = { status: 'ignored' };
    if (GRANT_EVENTS.has(x.type) && x.paymentId) {
      if (rows.some((r) => r.grantPaymentId === x.paymentId)) result = { status: 'duplicate_payment' };
      else if (x.email && x.plan && (await findAccountByEmail(x.email))) {
        await applyPlan(x.email, x.plan, PLANS[x.plan].credits);
        result = { status: 'applied', credits: PLANS[x.plan].credits, plan: x.plan };
      } else result = { status: 'unresolved', plan: x.plan };
    } else if (END_EVENTS.has(x.type) && x.email && (await findAccountByEmail(x.email))) {
      await applyPlan(x.email, 'FREE', 0);
      result = { status: 'status_only', plan: 'FREE' };
    }
    rows.push({
      webhookId, type: x.type, paymentId: x.paymentId, email: x.email, plan: x.plan, status: result.status,
      grantPaymentId: result.status === 'applied' ? x.paymentId : null, createdAt: new Date().toISOString(),
    });
    await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
    await fs.writeFile(EVENTS_FILE, JSON.stringify(rows));
    return result;
  });
}

/** Recent payment events for an organization's billing page. */
export async function listOrgPaymentEvents(orgId: string, limit = 20) {
  if (!dbEnabled()) return [];
  return prisma.paymentEvent.findMany({
    where: { orgId, status: { in: ['applied', 'status_only'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, type: true, plan: true, credits: true, status: true, createdAt: true },
  });
}
