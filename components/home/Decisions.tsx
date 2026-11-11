const DECISIONS = [
  {
    label: 'allow',
    cls: 'decision-allow',
    title: 'The action may proceed.',
    body: 'All enabled checks passed. Your agent continues, and the evidence ID is stored with the interaction.',
    example: 'Consent verified · DNC clear · calling hours OK',
  },
  {
    label: 'review',
    cls: 'decision-review',
    title: 'Pause or route to a human.',
    body: 'Something is inconclusive — for example, a reassigned-number check needs a human look. The agent should hold or escalate.',
    example: 'Reassignment risk inconclusive since consent date',
  },
  {
    label: 'block',
    cls: 'decision-block',
    title: 'The action should not happen.',
    body: 'A specific reason is returned — e.g. the number is on the National DNC Registry — and the evidence record captures why.',
    example: 'Number is on the National Do Not Call Registry',
  },
];

export default function Decisions() {
  return (
    <section style={{ padding: 'var(--spacing6) 0', background: 'var(--theme-page-alt)' }}>
      <div className="container">
        <span className="eyebrow">Three outcomes, no ambiguity</span>
        <h2 className="landing-section-title">Your agent gets an explicit decision.</h2>
        <p className="section-lede">
          VerifyOne&apos;s decision API returns one of three outcomes for the pre-action gate. The
          decision includes a specific reason and an evidence ID — no black-box scores your team has
          to interpret.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {DECISIONS.map((d) => (
            <div key={d.label} className="dp-card p-7" style={{ borderTop: `3px solid ${d.cls === 'decision-allow' ? 'var(--decision-allow)' : d.cls === 'decision-review' ? 'var(--decision-review)' : 'var(--decision-block)'}` }}>
              <span className={`font-mono text-sm font-semibold ${d.cls}`}>{d.label}</span>
              <h3 className="font-semibold text-lg mt-3 mb-2" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                {d.title}
              </h3>
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
                {d.body}
              </p>
              <p className="font-mono text-xs mt-4 pt-4" style={{ color: 'var(--theme-text-faint)', borderTop: '1px solid var(--theme-border)' }}>
                {d.example}
              </p>
            </div>
          ))}
        </div>

        <p className="text-sm mt-6" style={{ color: 'var(--theme-text-faint)' }}>
          The live v1 API currently returns ALLOW | DENY. The three-outcome decision API is the
          roadmap shape — see <a href="/docs#decision-values" className="underline">/docs#decision-values</a>.
        </p>
      </div>
    </section>
  );
}
