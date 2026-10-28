const plans = [
  {
    name: 'Starter',
    price: 149,
    credits: '30,000',
    features: ['Phone + Email + IP', 'Bulk CSV (5k rows)', 'API access', '7-day free trial', 'Credits roll over 3 months'],
    highlight: false,
    cta: 'Start free trial',
  },
  {
    name: 'Growth',
    price: 449,
    credits: '120,000',
    features: ['Everything in Starter', 'HLR lookups', 'DNC scrub', 'Priority support', 'Zapier / Make / n8n'],
    highlight: true,
    cta: 'Start free trial',
  },
  {
    name: 'Pro',
    price: 999,
    credits: '400,000',
    features: ['Everything in Growth', 'MCP AI agent endpoint', 'HubSpot native integration', 'Dedicated SLA', 'Custom credits'],
    highlight: false,
    cta: 'Contact sales',
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-ground-muted py-24 px-4 border-t border-b border-rule">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 rounded-full mb-3">
            Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight mb-3">
            Simple, usage-based pricing
          </h2>
          <p className="text-ink-secondary text-base">
            No contracts. Universal credits roll over 3 months. 7-day free trial on every plan.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-panel p-8 flex flex-col transition-all duration-160 ease-out ${
                plan.highlight
                  ? 'bg-panel border-2 border-accent shadow-lg shadow-accent/5'
                  : 'bg-panel border border-rule shadow-sm'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent text-white text-xs font-bold px-4 py-1 shadow-sm">
                  Most Popular
                </span>
              )}

              <p className="text-xs font-bold text-ink-secondary uppercase tracking-wider mb-2">
                {plan.name}
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-extrabold text-ink font-display tracking-tight">${plan.price}</span>
                <span className="text-ink-secondary text-sm">/month</span>
              </div>
              <p className="text-accent text-sm font-semibold mb-6">
                {plan.credits} credits / month
              </p>

              <div className="h-px bg-rule w-full mb-6" />

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/dashboard"
                className={`block text-center rounded-lg py-3 font-semibold text-sm transition-all duration-160 ${
                  plan.highlight
                    ? 'dp-btn-primary'
                    : 'dp-btn-secondary'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-ink-secondary text-xs mt-10">
          All plans include phone + email + IP validation. 1 credit = 1 core check. HLR = 5 credits. DNC = 10 credits.
        </p>
      </div>
    </section>
  );
}
