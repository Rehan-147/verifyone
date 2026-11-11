'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PLANS, PLAN_ORDER } from '../lib/plans';

export default function Pricing() {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startCheckout = async (planKey: string) => {
    const email = window.prompt('Work email for Dodo checkout:', '');
    if (!email) return;
    setBusy(planKey); setNotice(null);
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: planKey }),
      });
      const d = await r.json();
      if (d.checkout_url) { window.location.href = d.checkout_url; return; }
      setNotice(d.message || d.detail || d.error || 'Checkout unavailable — configure Dodo in .env');
    } catch {
      setNotice('Checkout unavailable');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="pricing" className="bg-ground py-24 px-4 border-t border-rule scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight mb-3">
            Pricing that scales with your gate checks
          </h2>
          <p className="text-ink-secondary max-w-2xl mx-auto leading-relaxed">
            Billed via <strong className="text-ink">Dodo Payments</strong> (merchant of record).
            Credits vary by enabled checks — at launch, the full pre-dial gate is bundled:{' '}
            <strong className="text-ink">one bundled credit per pre-dial check</strong>.
          </p>
        </div>
        {notice && <p className="text-center text-sm text-amber-700 mb-6">{notice}</p>}
        <div className="grid md:grid-cols-3 gap-6">
          {PLAN_ORDER.map((key) => {
            const plan = PLANS[key];
            const highlight = key === 'GROWTH';
            return (
              <div key={key} className={`dp-card p-8 flex flex-col ${highlight ? 'ring-2 ring-accent' : ''}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xl text-ink font-display">{plan.name}</h3>
                  {highlight && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                      Most picked
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-secondary mt-1">{plan.blurb}</p>
                <p className="text-3xl font-extrabold text-ink mt-4">
                  ${plan.priceUsd}
                  <span className="text-base font-normal text-ink-secondary">/month</span>
                </p>
                <p className="text-sm text-accent font-semibold mt-1 font-mono">
                  {plan.credits.toLocaleString('en-US')} credits/mo
                </p>
                <ul className="mt-6 space-y-2 text-sm text-ink-secondary flex-1">
                  {plan.features.map((f) => (<li key={f}>✓ {f}</li>))}
                </ul>
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => startCheckout(key)}
                  className={`mt-8 w-full py-3 rounded-lg font-semibold text-sm ${highlight ? 'dp-btn-primary' : 'border border-rule bg-panel text-ink hover:bg-ground-muted'}`}
                >
                  {busy === key ? 'Opening Dodo…' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Credit + trial notes */}
        <div className="mt-10 text-center space-y-2">
          <p className="text-sm text-ink-secondary">
            Credits roll over for 3 months. 7-day free trial on every plan.
          </p>
          <p className="text-xs text-ink-secondary/80">
            How credits work:{' '}
            <Link href="/pricing#credits" className="text-accent font-semibold hover:underline">
              credit costs &amp; calculator →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
