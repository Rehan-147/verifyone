import type { Metadata } from 'next';
import Link from 'next/link';
import ScanClient from '../../components/ScanClient';

export const metadata: Metadata = {
  title: 'Free Call List Risk Scan',
  description:
    'Upload a call list and see what share of numbers a pre-dial compliance gate would block or hold: litigator risk, DNC without consent, missing AI-voice consent, calling hours and disconnected numbers. No signup; numbers are not stored.',
  alternates: { canonical: 'https://app.verifyone.io/scan' },
};

export default function ScanPage() {
  return (
    <main className="bg-ground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <header className="max-w-3xl mb-10">
          <span className="inline-block rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-semibold text-accent tracking-widest uppercase mb-4">
            Free list scan · no signup
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
            How risky is your call list?
          </h1>
          <p className="text-ink-secondary leading-relaxed">
            Upload a CSV with a phone column (up to 1,000 rows). VerifyOne runs every number through the same
            pre-dial checks your AI agent would use and shows what share would be{' '}
            <strong className="text-ink">blocked</strong> or <strong className="text-ink">held for review</strong>, and why.
            Numbers are processed in memory and <strong className="text-ink">never stored</strong>; you only see totals.
          </p>
        </header>

        <ScanClient />

        <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="dp-card p-5">
            <h2 className="font-bold text-ink font-display mb-1">What it checks</h2>
            <p className="text-ink-secondary text-xs leading-relaxed">
              Number validity, disconnected lines, known TCPA litigators, federal DNC (without consent), AI-voice
              written consent (add a <code className="font-mono">consent_type</code> column) and calling hours right now.
            </p>
          </div>
          <div className="dp-card p-5">
            <h2 className="font-bold text-ink font-display mb-1">What it doesn&apos;t include</h2>
            <p className="text-ink-secondary text-xs leading-relaxed">
              Row-level results, evidence records, your internal opt-out list and call-frequency history. Those come
              with an account or a paid audit. See exactly which sources are connected on{' '}
              <Link href="/data-sources" className="text-accent hover:underline">/data-sources</Link>.
            </p>
          </div>
          <div className="dp-card p-5">
            <h2 className="font-bold text-ink font-display mb-1">Not legal advice</h2>
            <p className="text-ink-secondary text-xs leading-relaxed">
              VerifyOne provides compliance controls and evidence, not legal advice or a guarantee about any
              regulatory outcome.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
