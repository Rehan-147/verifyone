import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security & Trust',
  description:
    'How VerifyOne handles data: masked storage, tamper-evident evidence records, hashed API keys, access controls, audit logs, subprocessors, and incident response. No certification claims.',
  alternates: { canonical: 'https://app.verifyone.io/security' },
};

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'data-handling',
    title: 'Data handling approach',
    body: (
      <>
        <p>
          VerifyOne is designed to store the minimum needed for a compliance decision. Phone numbers are
          stored masked (last 4 digits) in evidence records — the full number is never written to the audit
          log in plaintext. Request context is limited to what the gate needs: number, channel, declared
          consent, and the checks you enabled.
        </p>
        <p>
          We do not sell contact data, and we do not build marketing profiles from gate requests. Check
          inputs are used to produce your decision and your evidence record.
        </p>
      </>
    ),
  },
  {
    id: 'evidence-retention',
    title: 'Evidence retention',
    body: (
      <>
        <p>
          Every gate request writes a tamper-evident, hash-chained record (JSONL, with optional Postgres/
          Supabase persistence). Records include the masked number, checks performed, decision, reason, and
          timestamps.
        </p>
        <p>
          Retention is customer-configured within plan limits. CSV export is available on paid plans via{' '}
          <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">GET /api/v1/gate/audit/export</code>.
        </p>
      </>
    ),
  },
  {
    id: 'access-controls',
    title: 'Access controls',
    body: (
      <>
        <p>
          API keys are shown once at creation and stored only as SHA-256 hashes. Requests are authenticated
          per key; per-key rate limits and monthly quotas apply. There are no shared accounts — create one
          key per agent or workflow so you can rotate independently.
        </p>
      </>
    ),
  },
  {
    id: 'audit-logs',
    title: 'Audit logs',
    body: (
      <>
        <p>
          Beyond per-request evidence, the platform keeps operational logs of plan grants, billing events,
          and data-source refreshes. The evidence chain is verifiable at any time via{' '}
          <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">GET /api/v1/gate/audit/chain</code>.
        </p>
      </>
    ),
  },
  {
    id: 'subprocessors',
    title: 'Subprocessors',
    body: (
      <>
        <p>
          Gate checks may call these upstream providers when the corresponding feature is enabled on your
          account:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-ink">Telnyx</strong> — carrier / line-type / HLR lookups (optional profile).</li>
          <li><strong className="text-ink">Reoon or ZeroBounce</strong> — email verification for the pre-send gate (optional).</li>
          <li><strong className="text-ink">IPinfo</strong> — IP intelligence for the IP lookup endpoint (optional).</li>
          <li><strong className="text-ink">Dodo Payments</strong> — merchant of record for billing.</li>
          <li><strong className="text-ink">Supabase</strong> — optional Postgres persistence for accounts and evidence.</li>
          <li><strong className="text-ink">Vercel</strong> — hosting and edge network.</li>
        </ul>
        <p>
          Registry files (FTC DNC, litigator feeds, FCC RNDB) are loaded as data files and processed in our
          own infrastructure. This list will be kept current as providers change.
        </p>
      </>
    ),
  },
  {
    id: 'incident-response',
    title: 'Incident response',
    body: (
      <>
        <p>
          Because evidence records are hash-chained, tampering with stored decisions is detectable — chain
          verification fails loudly. If an incident affects your data or evidence integrity, we will notify
          affected account contacts directly with what happened, what data was involved, and what we did
          about it.
        </p>
        <p>
          Report a security issue from your dashboard account or via the design-partner channel. Please do
          not test against production registries.
        </p>
      </>
    ),
  },
  {
    id: 'compliance-disclaimer',
    title: 'Compliance disclaimer',
    body: (
      <>
        <p>
          VerifyOne provides compliance controls and audit evidence. It does not provide legal advice and
          does not guarantee regulatory outcomes. We make no certification claims — no SOC 2, HIPAA, GDPR
          certification, or similar attestation is claimed or implied on this page. As we complete formal
          audits, this page will be updated with verifiable details.
        </p>
        <p>
          See the full <Link href="/legal/compliance-disclaimer" className="text-accent font-semibold hover:underline">compliance disclaimer</Link> and{' '}
          <Link href="/legal/data-processing" className="text-accent font-semibold hover:underline">data processing</Link> pages.
        </p>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <main className="bg-ground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
          Security &amp; trust
        </h1>
        <p className="text-ink-secondary leading-relaxed mb-10">
          How VerifyOne handles your data, protects your evidence, and stays auditable. Written to be read
          by your security reviewers, not to impress them.
        </p>
        <nav aria-label="Security sections" className="mb-10">
          <ul className="flex flex-wrap gap-2 text-xs font-mono">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-block rounded-full border border-rule bg-panel px-3 py-1 text-ink-secondary hover:text-ink hover:border-accent/40 transition-colors">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="dp-card p-7 scroll-mt-24">
              <h2 className="text-lg font-extrabold text-ink font-display tracking-tight mb-3">{s.title}</h2>
              <div className="space-y-3 text-sm text-ink-secondary leading-relaxed">{s.body}</div>
            </section>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/dashboard" className="dp-btn-secondary inline-flex items-center gap-2">
            Review the audit dashboard
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
