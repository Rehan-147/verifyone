import Link from 'next/link';

const PROBLEMS = [
  {
    title: 'Consent is fragmented',
    body: 'Consent may exist in a CRM, form, spreadsheet, or agent memory — but the calling agent cannot reliably use it at dial time.',
  },
  {
    title: 'DNC and reassigned-number risk changes',
    body: 'A list that was clean last month may not be safe today. Numbers can be reassigned, disconnected, or added to suppression lists.',
  },
  {
    title: 'Agents need evidence',
    body: 'When a customer, client, or regulator asks why a call happened, “the agent decided” is not an answer. Teams need a sealed decision record.',
  },
];

export default function Problem() {
  return (
    <section className="py-16 px-0" style={{ padding: 'var(--spacing6) 0' }}>
      <div className="container">
        <span className="eyebrow">The problem</span>
        <h2 className="landing-section-title">
          AI agents can dial anyone.
          <br />
          That does not mean they should.
        </h2>
        <p className="section-lede">
          AI calling platforms make outbound automation easy, but compliance decisions often remain
          manual: consent records, DNC scrubbing, reassigned-number checks, permitted calling hours,
          opt-outs, and audit trails.
        </p>
        <p className="section-lede" style={{ marginTop: '-1.5rem' }}>
          One bad campaign can create wasted dialer spend, customer complaints, client disputes, and
          regulatory exposure.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PROBLEMS.map((p, i) => (
            <div key={p.title} className="dp-card p-7">
              <span
                className="font-mono text-xs mb-4 block"
                style={{ color: 'var(--theme-text-faint)' }}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                {p.title}
              </h3>
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <p className="text-[15px] mt-8" style={{ color: 'var(--theme-text-secondary)' }}>
          The fix is not another dashboard — it is a decision your agent cannot skip.{' '}
          <Link href="/#how-it-works" className="cta-link" style={{ padding: 0, minHeight: 0, fontSize: 'inherit' }}>
            See how the gate works
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </p>
      </div>
    </section>
  );
}
