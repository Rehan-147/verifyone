import Link from 'next/link';
import { PLANS, PLAN_ORDER } from '../lib/plans';

export default function Pricing() {
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLAN_ORDER.map((key) => {
            const plan = PLANS[key];
            const highlight = key === 'GROWTH';
            return (
              <div key={key} className={`dp-card p-6 flex flex-col ${highlight ? 'ring-2 ring-accent' : ''}`}>
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
                  ${plan.priceUsd.toLocaleString('en-US')}
                  <span className="text-base font-normal text-ink-secondary">/month</span>
                </p>
                <p className="text-sm text-accent font-semibold mt-1 font-mono">
                  {plan.credits.toLocaleString('en-US')} credits/mo
                </p>
                <ul className="mt-6 space-y-2 text-sm text-ink-secondary flex-1">
                  {plan.features.map((f) => (<li key={f}>✓ {f}</li>))}
                </ul>
                <Link
                  href={`/dashboard/billing?plan=${key}`}
                  className={`mt-8 w-full py-3 rounded-lg font-semibold text-sm text-center ${highlight ? 'dp-btn-primary' : 'border border-rule bg-panel text-ink hover:bg-ground-muted'}`}
                >
                  Subscribe
                </Link>
              </div>
            );
          })}
        </div>

        {/* Credit + trial notes */}
        <div className="mt-10 text-center space-y-2">
          <p className="text-sm text-ink-secondary">
            Unused credits stay on your balance. Start free with starter credits — no card required.
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
