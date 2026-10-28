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
    <section className="bg-[#0A0F1E] py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center text-4xl font-extrabold text-white mb-2">
          Simple, usage-based pricing
        </h2>
        <p className="text-center text-gray-400 mb-12">
          No contracts. Credits roll over 3 months. 7-day free trial on every plan.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col transition-all ${
                plan.highlight
                  ? 'border-[#A3E635] bg-[#A3E635]/5 shadow-lg shadow-[#A3E635]/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#A3E635] text-black text-xs font-bold px-4 py-1">
                  Most Popular
                </span>
              )}

              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {plan.name}
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold text-white">\${plan.price}</span>
                <span className="text-gray-400 mb-1">/mo</span>
              </div>
              <p className="text-[#A3E635] text-sm font-semibold mb-6">
                {plan.credits} credits / month
              </p>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-[#A3E635] mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="/dashboard"
                className={`block text-center rounded-xl py-3 font-bold text-sm transition-colors ${
                  plan.highlight
                    ? 'bg-[#A3E635] hover:bg-[#bef264] text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-xs mt-8">
          All plans include phone + email + IP validation. 1 credit = 1 core check. HLR = 5 credits. DNC = 10 credits.
        </p>
      </div>
    </section>
  );
}
