'use client';
import { useState } from 'react';

const tabs = ['Overview', 'Bulk CSV', 'API Keys', 'Billing'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [credits, setCredits] = useState(1000);
  const [apiKey] = useState('vk_live_51H7xKLMn9qRs2...');
  const [copied, setCopied] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-ground text-ink">
      {/* Top subnav */}
      <div className="border-b border-rule bg-panel px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg font-display text-ink">
          Verify<span className="text-accent">One</span> Dashboard
        </span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-ink-secondary">
            <span className="text-ink font-semibold">{credits.toLocaleString()}</span> credits available
          </span>
          <span className="rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold px-3 py-0.5">
            STARTER PLAN
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight">Workspace Overview</h1>
            <p className="text-sm text-ink-secondary mt-1">Manage API keys, upload bulk CSV datasets, or inspect validation quotas.</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Credits Remaining', value: credits.toLocaleString(), color: 'text-accent' },
            { label: 'Checks Today', value: '0', color: 'text-ink' },
            { label: 'Active Plan', value: 'Starter', color: 'text-ink' },
          ].map((s) => (
            <div key={s.label} className="dp-card p-5">
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-extrabold font-display ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-ground-muted border border-rule rounded-lg p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all duration-160 ${
                activeTab === t
                  ? 'bg-panel text-ink shadow-sm border border-rule/50'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Overview' && (
          <div className="dp-card p-6">
            <h2 className="font-bold text-lg text-ink font-display mb-2">Quick API Integration</h2>
            <p className="text-ink-secondary text-sm mb-4">
              Use the single-query validator on the{' '}
              <a href="/" className="text-accent hover:underline font-medium">home page</a>{' '}
              or execute direct HTTP requests against the endpoints below with your secret API token.
            </p>
            <div className="rounded-lg bg-field text-on-field p-4 font-mono text-xs overflow-x-auto">
              <div className="text-on-field-secondary"># Example cURL Phone Validation</div>
              <div className="mt-1">
                <span className="text-blue-400">curl</span> -X POST https://app.verifyone.io/api/v1/validate_phone \
              </div>
              <div className="pl-4 text-on-field-secondary">
                -H &quot;Authorization: Bearer {apiKey}&quot; \
              </div>
              <div className="pl-4 text-on-field-secondary">
                -d &apos;{`{"phone": "+14155552671"}`}&apos;
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Bulk CSV' && (
          <div className="dp-card p-6">
            <h2 className="font-bold text-lg text-ink font-display mb-2">Bulk CSV Scrubbing</h2>
            <p className="text-ink-secondary text-sm mb-4">
              Upload a UTF-8 CSV containing a <code className="bg-ground-muted border border-rule px-1.5 py-0.5 rounded text-xs text-ink font-mono">phone</code>,{' '}
              <code className="bg-ground-muted border border-rule px-1.5 py-0.5 rounded text-xs text-ink font-mono">email</code>, or{' '}
              <code className="bg-ground-muted border border-rule px-1.5 py-0.5 rounded text-xs text-ink font-mono">ip</code> header column.
            </p>
            <label className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-rule hover:border-accent cursor-pointer transition-colors bg-ground-muted/40">
              <span className="text-ink-secondary text-sm font-medium">Drag & drop or click to upload CSV</span>
              <span className="text-xs text-ink-secondary/70 mt-1">Supports up to 50,000 records per file</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    const text = r.result as string;
                    const rows = text.split('\n').slice(1, 6).filter(Boolean).map((l) => ({ raw: l.trim(), status: 'valid' }));
                    setCsvRows(rows);
                    setCredits((c) => Math.max(0, c - rows.length));
                  };
                  r.readAsText(f);
                }}
              />
            </label>
            {csvRows.length > 0 && (
              <div className="mt-4 rounded-lg overflow-hidden border border-rule">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ground-muted border-b border-rule">
                      <th className="text-left px-4 py-2 text-ink-secondary font-semibold text-xs">#</th>
                      <th className="text-left px-4 py-2 text-ink-secondary font-semibold text-xs">Row Content</th>
                      <th className="text-left px-4 py-2 text-ink-secondary font-semibold text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule bg-panel">
                    {csvRows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-ink-secondary text-xs">{i + 1}</td>
                        <td className="px-4 py-2 text-ink truncate max-w-xs font-mono text-xs">{row.raw}</td>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-accent/10 border border-accent/20 text-accent text-xs px-2.5 py-0.5 font-semibold">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'API Keys' && (
          <div className="dp-card p-6">
            <h2 className="font-bold text-lg text-ink font-display mb-2">Live Production Key</h2>
            <p className="text-ink-secondary text-sm mb-4">
              Keep this key private. It provides authenticated access to your credit pool.
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-ground border border-rule rounded-lg px-4 py-3 text-sm text-ink font-mono truncate">
                {apiKey}
              </code>
              <button
                onClick={copyKey}
                className="dp-btn-primary px-5 py-3 text-sm"
              >
                {copied ? '✓ Copied' : 'Copy Key'}
              </button>
            </div>
            <p className="text-xs text-ink-secondary mt-3">
              Pass in HTTP headers as <code className="bg-ground-muted border border-rule px-1 py-0.5 rounded text-ink font-mono">Authorization: Bearer {'<key>'}</code>.
            </p>
          </div>
        )}

        {activeTab === 'Billing' && (
          <div className="dp-card p-6">
            <h2 className="font-bold text-lg text-ink font-display mb-2">Manage Subscription & Credit Packs</h2>
            <p className="text-ink-secondary text-sm mb-6">Unused credits roll over automatically for 90 days across all billing cycles.</p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { name: 'Starter', price: '$149/mo', credits: '30,000 credits', popular: false },
                { name: 'Growth', price: '$449/mo', credits: '120,000 credits', popular: true },
                { name: 'Pro', price: '$999/mo', credits: '400,000 credits', popular: false },
              ].map((p) => (
                <div
                  key={p.name}
                  className={`rounded-panel border p-5 flex flex-col justify-between ${
                    p.popular ? 'border-accent bg-accent/5' : 'border-rule bg-panel'
                  }`}
                >
                  <div>
                    {p.popular && <p className="text-accent text-[11px] font-bold uppercase tracking-wider mb-1">Most Popular</p>}
                    <p className="font-bold text-ink text-base">{p.name}</p>
                    <p className="text-2xl font-extrabold text-ink font-display mt-1">{p.price}</p>
                    <p className="text-ink-secondary text-xs mt-1">{p.credits}</p>
                  </div>
                  <button className={`mt-5 w-full rounded-lg text-xs font-semibold py-2.5 transition-all ${
                    p.popular ? 'dp-btn-primary' : 'dp-btn-secondary'
                  }`}>
                    Switch Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
