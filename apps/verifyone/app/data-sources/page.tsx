export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DATA_SOURCE_CATALOG } from '../../lib/data-sources';
import { buildDataSourceReceipts } from '../../lib/compliance-cache';
import { STATE_CALLING_RULES } from '../../lib/data/state-calling-rules';

export const metadata: Metadata = {
  title: 'Data Sources & Failure Policy',
  description:
    'Every check in the VerifyOne pre-dial gate: data source, ingest type, refresh cadence, coverage, live connection status, and fail-closed failure behaviour.',
  alternates: { canonical: 'https://app.verifyone.io/data-sources' },
};

const INGEST_LABEL: Record<string, string> = {
  local_file: 'Local registry file',
  live_api: 'Live API',
  derived: 'Derived / built-in',
  customer: 'Customer payload',
};

function statusBadge(status: string | undefined) {
  switch (status) {
    case 'live':
      return { label: 'Live', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' };
    case 'loaded':
      return { label: 'Loaded', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' };
    case 'derived':
      return { label: 'Built-in', cls: 'bg-accent/10 text-accent border-accent/30' };
    case 'customer':
      return { label: 'Per-call input', cls: 'bg-accent/10 text-accent border-accent/30' };
    case 'failed':
      return { label: 'Failed', cls: 'bg-red-500/10 text-red-700 border-red-500/30' };
    case 'missing':
    default:
      return { label: 'Not connected yet', cls: 'bg-amber-500/10 text-amber-800 border-amber-500/30' };
  }
}

export default function DataSourcesPage() {
  const receipts = buildDataSourceReceipts();
  const receiptMap = new Map(receipts.map((r) => [r.id, r]));
  const stateEntries = Object.entries(STATE_CALLING_RULES);

  return (
    <main className="bg-ground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <header className="max-w-3xl mb-10">
          <span className="inline-block rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-semibold text-accent tracking-widest uppercase mb-4">
            Data sources &amp; failure policy
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
            Where every gate decision comes from
          </h1>
          <p className="text-ink-secondary leading-relaxed">
            VerifyOne is fail-closed by default: when a required data source is unavailable or inconclusive,
            the gate returns <strong className="text-ink">REVIEW</strong> or <strong className="text-ink">DENY</strong> (block) — never
            a silent <strong className="text-ink">ALLOW</strong>. The table below is generated directly from{' '}
            <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">DATA_SOURCE_CATALOG</code>{' '}
            and live runtime receipts.
          </p>
        </header>

        {/* Catalog + Live Status */}
        <section className="space-y-4 mb-14" aria-label="Data source catalog">
          {DATA_SOURCE_CATALOG.map((src) => {
            const receipt = receiptMap.get(src.id);
            const badge = statusBadge(receipt?.status);
            return (
              <div key={src.id} className="dp-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-base font-extrabold text-ink font-display">{src.vendor}</h2>
                      <code className="font-mono text-[11px] bg-ground-muted border border-rule px-2 py-0.5 rounded text-ink-secondary">
                        {src.id}
                      </code>
                    </div>
                    <p className="text-xs text-ink-secondary mt-1">
                      Check: <span className="font-mono text-ink">{src.check}</span> · Ingest:{' '}
                      <span className="text-ink">{INGEST_LABEL[src.ingest] || src.ingest}</span> · Refresh:{' '}
                      <span className="text-ink">{src.refresh_sla}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border font-mono ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-ink-secondary leading-relaxed pt-3 border-t border-rule/60">
                  <div>
                    <p className="font-semibold text-ink mb-1">What it does</p>
                    <p>{src.what_it_does}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink mb-1">Coverage</p>
                    <p>{src.coverage}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink mb-1">Failure behaviour</p>
                    <p>{src.failure_behavior}</p>
                  </div>
                </div>

                {(receipt?.records !== undefined && receipt.records > 0) || receipt?.refreshed_at || receipt?.fix_hint ? (
                  <div className="mt-3 pt-3 border-t border-rule/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-secondary">
                    <div className="flex flex-wrap gap-4">
                      {receipt?.records !== undefined && receipt.records > 0 && (
                        <span>Records loaded: <strong className="text-ink">{receipt.records.toLocaleString()}</strong></span>
                      )}
                      {receipt?.refreshed_at && (
                        <span>Last refreshed: <strong className="text-ink">{receipt.refreshed_at}</strong></span>
                      )}
                    </div>
                    {receipt?.fix_hint && (
                      <span className="text-amber-800">{receipt.fix_hint}</span>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        {/* Honest operational notes */}
        <section className="dp-card p-7 mb-10" aria-labelledby="operational-notes-heading">
          <h2 id="operational-notes-heading" className="text-lg font-extrabold text-ink font-display tracking-tight mb-4">
            Operational notes &amp; known limitations
          </h2>
          <ul className="space-y-3 text-sm text-ink-secondary leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-ink">FTC National DNC:</strong> Official access is area-code downloads under
              the customer&apos;s own Subscription Account Number (SAN); there is no real-time FTC API.
            </li>
            <li>
              <strong className="text-ink">Consent:</strong> VerifyOne verifies and records consent claims
              (including optional TrustedForm certificates on <code className="font-mono text-xs">full_stack</code>); it does not create consent.
            </li>
            <li>
              <strong className="text-ink">Calling hours:</strong> Enforces the federal 8:00–21:00 local window
              (47 CFR § 64.1200(c)(1)) plus stricter state windows currently configured in{' '}
              <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">lib/data/state-calling-rules.ts</code>:{' '}
              {stateEntries.map(([st, r], idx) => (
                <span key={st}>
                  {idx > 0 ? ', ' : ''}
                  <strong className="text-ink">{st}</strong> ({r.start}–{r.end}, {r.citation})
                </span>
              ))}
              . Other states and Sunday/holiday restrictions are <strong className="text-ink">state rules pending counsel review</strong>.
            </li>
            <li>
              <strong className="text-ink">Litigator list:</strong> Depends on the licensed feed in use; coverage
              and refresh cadence follow your vendor contract.
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-ink-secondary">
          <span>
            Machine-readable catalog:{' '}
            <Link href="/api/v1/data-sources" className="font-mono text-accent hover:underline">
              GET /api/v1/data-sources
            </Link>
          </span>
          <div className="flex gap-4">
            <Link href="/security" className="text-accent font-semibold hover:underline">
              Security &amp; trust →
            </Link>
            <Link href="/docs" className="text-accent font-semibold hover:underline">
              API documentation →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
