import Link from 'next/link';

const EVIDENCE_ROWS: [string, React.ReactNode][] = [
  ['Evidence ID', <code key="id" className="font-mono text-xs" style={{ color: 'var(--theme-text-primary)' }}>ev_01J9X7Q2M4</code>],
  ['Decision', <span key="d" className="font-mono text-xs font-bold decision-block">block</span>],
  ['Reason', <span key="r" className="text-xs" style={{ color: 'var(--theme-text-primary)' }}>National DNC match</span>],
  ['Requested at', <code key="t" className="font-mono text-xs" style={{ color: 'var(--theme-text-primary)' }}>2026-11-04T18:22:04Z</code>],
  ['Checks', <span key="c" className="text-xs" style={{ color: 'var(--theme-text-primary)' }}>Internal suppression, FTC DNC, FCC RND, carrier status</span>],
  ['Agent action', <span key="a" className="text-xs" style={{ color: 'var(--theme-text-primary)' }}>Dial blocked</span>],
  ['Retention', <span key="rt" className="text-xs" style={{ color: 'var(--theme-text-primary)' }}>Customer-configured</span>],
];

const EVIDENCE_POINTS = [
  <>Records are hash-chained — altering any record breaks the chain and is detectable.</>,
  <>
    Retrieve any decision:{' '}
    <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-surface-muted)' }}>
      GET /api/v1/gate/audit/&#123;evidence_id&#125;
    </code>
  </>,
  <>
    Verify the full chain:{' '}
    <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-surface-muted)' }}>
      GET /api/v1/gate/audit/chain
    </code>
  </>,
  <>Export per-campaign CSV evidence for clients or counsel.</>,
];

export default function AuditEvidence() {
  return (
    <section style={{ padding: 'var(--spacing6) 0' }}>
      <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="eyebrow">Audit evidence</span>
          <h2 className="landing-section-title">Every decision leaves evidence.</h2>
          <p className="section-lede">
            VerifyOne creates a tamper-evident audit record for each gate request. The record includes the
            request context, checks performed, decision, reason, timestamps, and evidence ID.
          </p>
          <ul className="space-y-3 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {EVIDENCE_POINTS.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="font-mono text-xs mt-1 shrink-0"
                  style={{ color: 'var(--theme-text-faint)' }}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Evidence record card */}
        <div className="dp-card overflow-hidden">
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: 'var(--theme-surface-subtle)', borderBottom: '1px solid var(--theme-border)' }}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
              Evidence record
            </span>
            <span className="font-mono text-[11px]" style={{ color: 'var(--decision-allow)' }}>
              sealed · chain verified
            </span>
          </div>
          <dl>
            {EVIDENCE_ROWS.map(([k, v], i) => (
              <div
                key={k}
                className="flex gap-4 px-5 py-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--theme-border)' }}
              >
                <dt className="w-32 shrink-0 text-xs font-semibold" style={{ color: 'var(--theme-text-muted)', fontFamily: 'var(--font-display)' }}>
                  {k}
                </dt>
                <dd className="min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--theme-text-faint)' }}>
              Example record with fixture values — not a live response.
            </p>
          </div>
        </div>
      </div>

      <div className="container mt-10">
        <Link href="/dashboard" className="cta-btn">See the audit dashboard</Link>
      </div>
    </section>
  );
}
