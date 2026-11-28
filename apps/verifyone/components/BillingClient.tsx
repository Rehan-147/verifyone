'use client';

import { useState } from 'react';
import { PLANS, PLAN_ORDER, type PlanName } from '../lib/plans';

export default function BillingClient({
  currentPlan,
  hasSubscription,
  isAdmin,
  preselect,
}: {
  currentPlan: string;
  hasSubscription: boolean;
  isAdmin: boolean;
  preselect: PlanName | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = hasSubscription && currentPlan !== 'FREE';

  async function subscribe(plan: PlanName) {
    setBusy(plan);
    setNotice(null);
    try {
      const res = await fetch('/api/dashboard/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      setNotice(data.message || data.error || 'Checkout is unavailable right now.');
    } catch {
      setNotice('Checkout is unavailable right now.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      {notice && <p className="text-sm text-amber-700">{notice}</p>}
      {!isAdmin && <p className="text-sm text-ink-secondary">Only organization admins can change the subscription.</p>}
      {locked && (
        <p className="text-sm text-ink-secondary">
          This organization has an active subscription. To change plan, cancel it from the link in your Dodo receipt
          email, then subscribe again here.
        </p>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const isCurrent = currentPlan === key;
          const highlight = preselect === key;
          return (
            <div key={key} className={`dp-card p-6 flex flex-col ${highlight ? 'ring-2 ring-accent' : ''}`}>
              <h3 className="font-bold text-lg text-ink font-display">{plan.name}</h3>
              <p className="text-2xl font-extrabold text-ink mt-2">
                ${plan.priceUsd.toLocaleString('en-US')}
                <span className="text-sm font-normal text-ink-secondary">/month</span>
              </p>
              <p className="text-xs text-accent font-semibold font-mono mt-1">{plan.credits.toLocaleString('en-US')} credits/mo</p>
              <ul className="mt-4 space-y-1 text-xs text-ink-secondary flex-1">
                {plan.features.map((f) => (<li key={f}>✓ {f}</li>))}
              </ul>
              <button
                type="button"
                disabled={!isAdmin || locked || busy !== null}
                onClick={() => subscribe(key)}
                className="mt-5 w-full py-2.5 rounded-lg font-semibold text-sm dp-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCurrent ? 'Current plan' : busy === key ? 'Opening checkout…' : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
