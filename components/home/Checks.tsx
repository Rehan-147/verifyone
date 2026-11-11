const CHECKS = [
  { name: 'Internal suppression', detail: 'Opt-outs, complaints, and client-specific exclusion lists.' },
  { name: 'FTC Do Not Call', detail: 'National DNC Registry status for the number being dialed.' },
  { name: 'FCC reassigned-number risk', detail: 'Reassignment risk since the consent date, using an RNDB.' },
  { name: 'Carrier & line status', detail: 'Disconnected, invalid, or high-risk line signals.' },
  { name: 'Litigator risk', detail: 'Known serial-plaintiff and litigator-feed risk scores.' },
  { name: 'Consent & calling hours', detail: 'Express-written vs. DNC-exempt consent and time-zone rules.' },
];

export default function Checks() {
  return (
    <section style={{ padding: 'var(--spacing6) 0' }}>
      <div className="container">
        <span className="eyebrow">What the gate checks</span>
        <h2 className="landing-section-title">Every decision runs the same discipline.</h2>
        <p className="section-lede">
          Each outbound request is evaluated against the enabled checks. Risk scoring combines the
          results, and the decision includes the specific reason — not just a score.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CHECKS.map((c) => (
            <div key={c.name} className="dp-card px-6 py-5">
              <p className="font-semibold text-[15px] mb-1" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                {c.name}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>{c.detail}</p>
            </div>
          ))}
        </div>

        <p className="text-sm mt-6" style={{ color: 'var(--theme-text-faint)' }}>
          Credits vary by the checks enabled — the full gate is bundled at launch.
        </p>
      </div>
    </section>
  );
}
