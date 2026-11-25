import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security & Trust',
  description:
    'How VerifyOne secures API keys, platform credentials, hash-chained evidence, data minimisation, subprocessors, CI testing, and current certification status.',
  alternates: { canonical: 'https://app.verifyone.io/security' },
};

const SUBPROCESSORS: { name: string; role: string; status: 'Active' | 'Planned' }[] = [
  { name: 'Vercel', role: 'Application hosting and edge network', status: 'Active' },
  { name: 'Supabase', role: 'Managed Postgres database for accounts, bulk jobs, and evidence', status: 'Active' },
  { name: 'Clerk', role: 'User authentication for the web dashboard', status: 'Active' },
  { name: 'Telnyx', role: 'Optional live carrier / line-type / HLR lookups (full_stack profile)', status: 'Active' },
  { name: 'Dodo Payments', role: 'Merchant of record for subscriptions and billing', status: 'Active' },
  { name: 'Resend', role: 'Transactional email delivery', status: 'Planned' },
  { name: 'Upstash', role: 'Distributed rate limiting', status: 'Planned' },
];

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'api-keys',
    title: 'API keys',
    body: (
      <p>
        API keys are shown once at creation and stored only as SHA-256 hashes. Requests are authenticated per
        key with per-key rate limits and monthly quotas. Create separate keys per agent or workflow so you can
        rotate or revoke independently.
      </p>
    ),
  },
  {
    id: 'platform-credentials',
    title: 'Platform credentials (dial-through)',
    body: (
      <p>
        Third-party voice platform credentials (such as Vapi or Retell keys stored for dial-through) are encrypted
        at rest with <strong className="text-ink">AES-256-GCM</strong> using an encryption key loaded from the{' '}
        <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">VERIFYONE_CREDENTIALS_KEY</code>{' '}
        environment variable. Plaintext credentials are never returned by API responses (only the last 4
        characters and metadata are exposed).
      </p>
    ),
  },
  {
    id: 'evidence',
    title: 'Evidence integrity',
    body: (
      <>
        <p>
          Every gate request writes a <strong className="text-ink">SHA-256 hash-chained</strong> evidence record
          (Postgres with row locking, or local JSONL in single-process dev mode). Each record&apos;s hash links
          to the previous record, so altering stored decisions breaks chain verification.
        </p>
        <p>
          Single-record compliance artifacts exported via{' '}
          <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">GET /api/v1/gate/audit/&#123;id&#125;/export</code>{' '}
          are signed with HMAC (<code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">EVIDENCE_EXPORT_SECRET</code>).
          Chain verification is available at{' '}
          <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">GET /api/v1/gate/audit/chain</code>.
        </p>
      </>
    ),
  },
  {
    id: 'data-minimisation',
    title: 'Data minimisation & retention',
    body: (
      <>
        <p>
          Phone numbers are stored hashed and masked (last 4 digits only) in evidence records — the full number is
          never written to the audit log in plaintext. We do not sell contact data or build marketing profiles
          from gate requests.
        </p>
        <p>
          Uploaded bulk screening jobs and their row records expire and are purged after{' '}
          <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">BULK_RETENTION_DAYS</code>{' '}
          (default <strong className="text-ink">30 days</strong>). Bulk risk reports contain aggregate counts only
          and never include phone numbers.
        </p>
      </>
    ),
  },
  {
    id: 'subprocessors',
    title: 'Infrastructure & subprocessors',
    body: (
      <>
        <p>
          The table below lists our infrastructure providers and subprocessors, including services that are
          planned but not yet active in production:
        </p>
        <div className="overflow-x-auto rounded-xl border border-rule my-3">
          <table className="w-full text-xs">
            <thead className="bg-ground-muted">
              <tr>
                <th className="p-3 text-left font-semibold text-ink-secondary">Provider</th>
                <th className="p-3 text-left font-semibold text-ink-secondary">Purpose</th>
                <th className="p-3 text-left font-semibold text-ink-secondary">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {SUBPROCESSORS.map((sp) => (
                <tr key={sp.name}>
                  <td className="p-3 font-semibold text-ink whitespace-nowrap">{sp.name}</td>
                  <td className="p-3 text-ink-secondary">{sp.role}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`font-mono px-2 py-0.5 rounded border ${
                      sp.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                    }`}>
                      {sp.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          See <Link href="/data-sources" className="text-accent font-semibold hover:underline">/data-sources</Link>{' '}
          for registry feeds, live connection status, and fail-closed failure behaviour.
        </p>
      </>
    ),
  },
  {
    id: 'testing',
    title: 'Testing & CI',
    body: (
      <p>
        Continuous integration runs on every change: TypeScript typecheck (<code className="font-mono text-xs">tsc --noEmit</code>),
        production Next.js build, and automated integration test suites (including Postgres persistence, quota,
        credits, calling hours, bulk screening, and hash-chain concurrency).
      </p>
    ),
  },
  {
    id: 'not-yet',
    title: 'What we do not claim yet',
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-ink">SOC 2:</strong> Not certified; a security overview is available on request.
          </li>
          <li>
            <strong className="text-ink">Penetration testing:</strong> No third-party penetration test has been completed yet.
          </li>
          <li>
            <strong className="text-ink">Other certifications &amp; SLAs:</strong> We do not claim HIPAA, ISO 27001, GDPR
            certification, or contractual uptime SLAs.
          </li>
        </ul>
        <p>
          VerifyOne provides compliance controls and audit evidence. It does not provide legal advice and does not
          guarantee regulatory outcomes. See the{' '}
          <Link href="/legal/compliance-disclaimer" className="text-accent font-semibold hover:underline">compliance disclaimer</Link>{' '}
          and{' '}
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
          How VerifyOne secures keys, credentials, evidence, and customer data. Only controls verifiable in the
          running codebase are listed here.
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

        <div className="text-center mt-12 flex flex-wrap justify-center gap-4">
          <Link href="/data-sources" className="dp-btn-secondary inline-flex items-center gap-2">
            View data sources &amp; failure policy
          </Link>
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
