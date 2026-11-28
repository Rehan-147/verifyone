import type { Metadata } from 'next';
import Link from 'next/link';
import Pricing from '../../components/Pricing';
import VolumeCalculator from '../../components/VolumeCalculator';
import { PLANS } from '../../lib/plans';

// Generated from lib/plans.ts so the advertised prices can never drift from what checkout grants.
const PLAN_SUMMARY = Object.values(PLANS)
  .map((p) => `${p.name} $${p.priceUsd.toLocaleString('en-US')}/mo (${p.credits.toLocaleString('en-US')} credits)`)
  .join(', ');

export const metadata: Metadata = {
  title: 'Pricing — Plans & Credits',
  description:
    `VerifyOne pricing: ${PLAN_SUMMARY}. One credit per standard pre-dial gate check; full_stack checks cost 5 credits.`,
  alternates: { canonical: 'https://app.verifyone.io/pricing' },
};

const CREDIT_FAQ = [
  {
    q: 'Do unused credits expire?',
    a: 'Not today. Each paid billing period adds that plan\'s credits to your balance, and unused credits stay on the balance. Any change to this will be published on this page before it takes effect.',
  },
  {
    q: 'What happens if I run out of credits mid-campaign?',
    a: 'Authenticated gate checks stop: the API returns HTTP 402 (insufficient_credits) and no call decision is issued, so your dialer must treat it as do-not-call. Nothing is silently allowed. Upgrade or wait for your next billing period to resume. There is no automatic overage billing.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes. Cancel any time from the billing provider (Dodo Payments). Your plan stays active until the end of the current billing period; credits already granted stay on your balance after the plan ends.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Paid plans have no trial period. You can evaluate for free instead: a free account includes starter credits, keyless requests get 500 gate checks/month per IP, and the free list scan at /scan needs no account — no card required for any of them.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Checkout is handled by Dodo Payments (merchant of record), which handles tax and standard payment methods. Enterprise/custom arrangements: apply from the dashboard.',
  },
];

export default function PricingPage() {
  return (
    <main className="bg-ground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
            Pricing
          </h1>
          <p className="text-ink-secondary leading-relaxed">
            Put a pre-dial compliance gate in front of every AI outbound campaign. Start free, scale when
            your campaigns do.
          </p>
        </div>

        {/* Plan cards — same component as the homepage; checkout behavior unchanged */}
        <div id="plans" className="scroll-mt-24 -mx-4 sm:mx-0">
          <Pricing />
        </div>

        {/* What is a credit? */}
        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-ink font-display tracking-tight mb-4">What is a credit?</h2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">
            A credit is VerifyOne&apos;s unit of metering. At launch, the full pre-dial gate is bundled:
            <strong className="text-ink"> one bundled credit covers one complete pre-dial gate check</strong>{' '}
            (validity, litigator screening, federal DNC, consent recording, and calling hours). Credits vary
            by enabled checks — heavier profiles cost more:
          </p>
          <div className="overflow-x-auto rounded-xl border border-rule">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-ground-muted">
                <tr>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Check profile</th>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Credits</th>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                <tr>
                  <td className="p-3 font-mono text-xs">ai_outbound_shield (default)</td>
                  <td className="p-3 font-mono text-xs">1 per check</td>
                  <td className="p-3 text-ink-secondary">Full bundled pre-dial gate from local caches.</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">full_stack</td>
                  <td className="p-3 font-mono text-xs">5 per check</td>
                  <td className="p-3 text-ink-secondary">Adds live carrier / line-type status and the reassigned-number check (paid per-lookup data sources).</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">Email gate</td>
                  <td className="p-3 font-mono text-xs">1 per check</td>
                  <td className="p-3 text-ink-secondary">Pre-send decision for AI SDRs (send / hold / block).</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-secondary/70 mt-3 leading-relaxed">
            This is the current launch metering. Per-check-type credit costs may be introduced later and will
            be documented in <Link href="/docs#rate-limits-and-credits" className="text-accent font-semibold hover:underline">the docs</Link> before they change.
          </p>
        </section>

        {/* Volume calculator */}
        <section className="mt-16">
          <VolumeCalculator />
        </section>

        {/* Free evaluation terms */}
        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-ink font-display tracking-tight mb-4">Free evaluation</h2>
          <ul className="text-sm text-ink-secondary space-y-2 list-disc pl-5 leading-relaxed">
            <li>Free tier (no plan): 500 gate checks/month per IP, no card required.</li>
            <li>Free account: starter credits, no card required — enough to evaluate the gate in your stack.</li>
            <li>Free list scan at <Link href="/scan" className="text-accent font-semibold hover:underline">/scan</Link>: aggregate risk summary for a CSV, no account.</li>
            <li>Paid plans have no trial period; unused paid credits stay on your balance.</li>
          </ul>
        </section>

        {/* Billing FAQ */}
        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-ink font-display tracking-tight mb-6">Billing FAQ</h2>
          <div className="space-y-4">
            {CREDIT_FAQ.map((f) => (
              <div key={f.q} className="dp-card p-6">
                <h3 className="font-bold text-sm text-ink font-display mb-2">{f.q}</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center mt-14">
          <Link href="/dashboard" className="dp-btn-primary inline-flex items-center gap-2">
            Test the Pre-Dial Gate
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
