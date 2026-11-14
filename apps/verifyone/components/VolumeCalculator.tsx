'use client';

import { useState } from 'react';
import Link from 'next/link';

// Volume estimator. Deliberately simple: recommends the smallest plan whose
// monthly credit allowance covers the entered volume at the launch bundled
// metering (1 bundled credit per pre-dial gate check). No overage pricing is
// implied — overage is not part of the current billing implementation.
const PLANS = [
  { key: 'Starter', credits: 30_000, price: 149 },
  { key: 'Growth', credits: 120_000, price: 449 },
  { key: 'Pro', credits: 400_000, price: 999 },
];

export default function VolumeCalculator() {
  const [checks, setChecks] = useState(25_000);

  const fit = PLANS.find((p) => p.credits >= checks);
  const campaignsPerMonth = Math.round(checks / 30);

  return (
    <div className="dp-card p-7 max-w-2xl mx-auto">
      <h3 className="font-bold text-lg text-ink font-display mb-1">Volume estimate calculator</h3>
      <p className="text-sm text-ink-secondary mb-5">
        Drag to your expected monthly pre-dial checks. Assumes the launch bundled metering — one bundled
        credit per gate check.
      </p>

      <label htmlFor="vol-checks" className="block text-sm font-semibold text-ink mb-2">
        Gate checks per month:{' '}
        <span className="font-mono text-accent">{checks.toLocaleString('en-US')}</span>
      </label>
      <input
        id="vol-checks"
        type="range"
        min={1_000}
        max={500_000}
        step={1_000}
        value={checks}
        onChange={(e) => setChecks(Number(e.target.value))}
        className="w-full accent-[#0074e2] cursor-pointer"
      />
      <div className="flex justify-between text-[11px] text-ink-secondary font-mono mt-1 mb-6">
        <span>1k</span><span>250k</span><span>500k</span>
      </div>

      <div className="rounded-xl bg-ground-muted border border-rule p-5">
        {fit ? (
          <p className="text-sm text-ink leading-relaxed">
            <strong className="font-semibold">{checks.toLocaleString('en-US')}</strong> checks/month ≈{' '}
            <strong className="font-semibold">{checks.toLocaleString('en-US')}</strong> bundled credits → the{' '}
            <Link href="#plans" className="text-accent font-semibold hover:underline">
              {fit.key} plan ({fit.credits.toLocaleString('en-US')} credits, ${fit.price}/mo)
            </Link>{' '}
            covers it with headroom. Roughly {campaignsPerMonth.toLocaleString('en-US')} checks/day.
          </p>
        ) : (
          <p className="text-sm text-ink leading-relaxed">
            <strong className="font-semibold">{checks.toLocaleString('en-US')}</strong> checks/month exceeds the Pro
            plan allowance (400,000 credits). <Link href="#plans" className="text-accent font-semibold hover:underline">Pro</Link>{' '}
            includes custom credits — or batch-screen lists and gate at dial time to reduce per-campaign volume.
          </p>
        )}
      </div>

      <p className="text-[11px] text-ink-secondary/70 mt-4 leading-relaxed">
        Estimate only — actual credit usage depends on enabled checks and profiles (for example full_stack
        HLR = 3 credits). This calculator does not represent an overage price or a quote.
      </p>
    </div>
  );
}
