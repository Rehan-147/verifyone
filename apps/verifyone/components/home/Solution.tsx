const FLOW = [
  { label: 'AI agent', detail: 'Your Vapi, Retell, Bland, Pipecat, or custom agent is about to dial or send.' },
  { label: 'VerifyOne Pre-Dial Gate', detail: 'One API call with the number and campaign context. Sub-second by default.', brand: true },
  { label: 'Checks', detail: 'Suppression, DNC, reassigned number, carrier, litigator risk, consent, calling hours.' },
  { label: 'Decision: allow · review · block', detail: 'An explicit decision plus a specific reason and an evidence ID.' },
  { label: 'Agent acts, escalates, or stops', detail: 'allow — proceed · review — pause or route to a human · block — do not act.' },
  { label: 'Tamper-evident evidence record', detail: 'A hash-chained audit record is written for every request, allow or block.' },
];

export default function Solution() {
  return (
    <section id="how-it-works" className="scroll-mt-20" style={{ padding: 'var(--spacing6) 0', background: 'var(--theme-page-alt)' }}>
      <div className="container grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <span className="eyebrow">How it works</span>
          <h2 className="landing-section-title">One gate before every outbound action.</h2>
          <p className="section-lede">
            VerifyOne sits between your AI agent and the outbound action. It does not replace your
            dialer, CRM, or AI platform. It gives them a compliance decision layer.
          </p>
          <p className="text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>
            Works with any stack that can make an HTTPS call —{' '}
            <a href="/docs#platform-examples" className="underline" style={{ color: 'var(--theme-brand)' }}>see platform examples</a>.
          </p>
        </div>

        {/* Flow — single stacked card, Caution differentiator-stack style */}
        <div className="dp-card overflow-hidden">
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {FLOW.map((step, i) => (
              <li
                key={step.label}
                className="flex gap-4 px-6 py-4"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--theme-border)',
                  background: step.brand ? 'var(--theme-accent-surface-subtle)' : 'transparent',
                }}
              >
                <span
                  className="font-mono text-xs pt-0.5 shrink-0"
                  style={{ color: step.brand ? 'var(--theme-brand)' : 'var(--theme-text-faint)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-semibold text-[15px]" style={{ color: step.brand ? 'var(--theme-brand)' : 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                    {step.label}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
