'use client';

import { useState } from 'react';
import Link from 'next/link';

type ScanResult = {
  scan_id: string;
  totals: { rows: number; unique: number; invalid: number; duplicates: number; screened: number };
  value: { risky_actions_prevented: number; held_for_review: number; clear_to_call: number; risky_percent: number };
  by_reason: Record<string, number>;
  risk_breakdown: Record<string, { count: number; percent: number }>;
  data_warning: string | null;
  privacy: string;
  disclaimer: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  internal_dnc: 'On an internal opt-out list',
  litigator_hits: 'Known TCPA litigator',
  dnc_listed_without_consent: 'Federal DNC without consent',
  ai_voice_consent_missing: 'AI-voice written consent missing',
  reassigned: 'Reassigned number',
  disconnected: 'Disconnected',
  quiet_hours_now: 'Outside calling hours right now',
  frequency_capped: 'Call-frequency limit reached',
};

const ERROR_TEXT: Record<string, string> = {
  phone_column_not_found: 'We could not find a phone column. Name it phone, phone_number, mobile, number or to.',
  too_many_rows: 'The free scan handles up to 1,000 rows. For bigger lists, request a full audit.',
  scan_limit_reached: 'You have reached the free scan limit for today. Try again tomorrow or request a full audit.',
  scan_capacity_reached: 'The free scanner is busy right now. Please try again in an hour.',
  file_too_large: 'That file is too large for the free scan (1 MB max).',
  invalid_csv: 'That file does not look like a valid CSV.',
  empty_csv: 'The file has no data rows.',
};

export default function ScanClient() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [leadState, setLeadState] = useState<'idle' | 'sent' | 'error'>('idle');

  async function runScan(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Choose a CSV file first.'); return; }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/scan', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(ERROR_TEXT[data.error] || 'The scan could not be completed. Please try again.'); return; }
      setResult(data as ScanResult);
    } finally {
      setBusy(false);
    }
  }

  async function sendLead(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/scan/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, scan_id: result?.scan_id, consent_to_contact: consent }),
    });
    setLeadState(res.ok ? 'sent' : 'error');
  }

  return (
    <div className="space-y-8">
      <form onSubmit={runScan} className="dp-card p-6 space-y-4">
        <label className="block text-sm font-semibold text-ink" htmlFor="scan-file">Call list (CSV)</label>
        <input
          id="scan-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-secondary"
          disabled={busy}
        />
        <p className="text-xs text-ink-secondary">
          Needs a <code className="font-mono">phone</code> column. Optional <code className="font-mono">consent_type</code>{' '}
          column: <code className="font-mono">express_written</code>, <code className="font-mono">ebr</code> or{' '}
          <code className="font-mono">none</code>. Up to 1,000 rows, 3 scans a day.
        </p>
        <button type="submit" disabled={busy || !file} className="dp-btn-primary text-sm">
          {busy ? 'Scanning…' : 'Scan my list'}
        </button>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </form>

      {result && (
        <section className="space-y-6" aria-live="polite">
          {result.data_warning && (
            <div className="dp-card p-4 border-amber-500/40 bg-amber-500/5" role="alert">
              <p className="text-sm text-amber-900"><strong>Preview data:</strong> {result.data_warning}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Numbers screened</p>
              <p className="text-3xl font-extrabold text-ink font-display mt-1">{result.totals.screened.toLocaleString()}</p>
            </div>
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Would be blocked</p>
              <p className="text-3xl font-extrabold text-ink font-display mt-1">{result.value.risky_actions_prevented.toLocaleString()}</p>
            </div>
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Held for review</p>
              <p className="text-3xl font-extrabold text-ink font-display mt-1">{result.value.held_for_review.toLocaleString()}</p>
            </div>
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Risky share</p>
              <p className="text-3xl font-extrabold text-ink font-display mt-1">{result.value.risky_percent}%</p>
            </div>
          </div>

          <div className="dp-card p-6">
            <h2 className="text-base font-bold text-ink font-display mb-3">Why numbers were flagged</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-secondary">
                  <th className="py-1 font-medium">Reason</th>
                  <th className="py-1 font-medium text-right">Numbers</th>
                  <th className="py-1 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.risk_breakdown).filter(([, v]) => v.count > 0).map(([key, v]) => (
                  <tr key={key} className="border-t border-rule">
                    <td className="py-2 text-ink">{CATEGORY_LABEL[key] ?? key}</td>
                    <td className="py-2 text-right text-ink">{v.count}</td>
                    <td className="py-2 text-right text-ink-secondary">{v.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-ink-secondary mt-3">
              {result.totals.invalid} invalid and {result.totals.duplicates} duplicate rows were skipped. {result.privacy}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="dp-card p-6 space-y-3">
              <h2 className="text-base font-bold text-ink font-display">See which numbers, with evidence</h2>
              <p className="text-sm text-ink-secondary">
                A free account gives you row-level results, a sealed evidence record for every decision and your own
                opt-out list. Or get a full audit of your list.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/sign-up" className="dp-btn-primary text-xs">Create free account</Link>
                <Link href="/pricing" className="dp-btn-secondary text-xs">See audit &amp; plans</Link>
              </div>
            </div>

            <form onSubmit={sendLead} className="dp-card p-6 space-y-3">
              <h2 className="text-base font-bold text-ink font-display">Talk to us about this list</h2>
              {leadState === 'sent' ? (
                <p className="text-sm text-ink">Thanks — we&apos;ll be in touch about a full audit.</p>
              ) : (
                <>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    className="w-full rounded-lg border border-rule bg-ground px-3 py-2 text-sm text-ink"
                  />
                  <label className="flex items-start gap-2 text-xs text-ink-secondary">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" required />
                    VerifyOne may email me about this scan and a full audit. We never share your email.
                  </label>
                  <button type="submit" disabled={!consent} className="dp-btn-secondary text-xs">Contact me</button>
                  {leadState === 'error' && <p className="text-xs text-red-700">That didn&apos;t work — check the email and try again.</p>}
                </>
              )}
            </form>
          </div>

          <p className="text-xs text-ink-secondary">{result.disclaimer}</p>
        </section>
      )}
    </div>
  );
}
