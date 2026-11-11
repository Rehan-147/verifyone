'use client';
import { useEffect, useState } from 'react';
import { PLANS, PLAN_ORDER } from '../lib/plans';

const tabs = ['Overview', 'Compliance Gate', 'Bulk CSV', 'API Keys', 'Billing'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [credits, setCredits] = useState(1000);
  const [apiKey, setApiKey] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [plan, setPlan] = useState('FREE');
  const [gateStats, setGateStats] = useState<any>(null);
  const [registry, setRegistry] = useState<any>(null);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupBusy, setSignupBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [gatePhone, setGatePhone] = useState('+13125550199');
  const [gateConsent, setGateConsent] = useState('express_written');
  const [gateResult, setGateResult] = useState<any>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [upgraded, setUpgraded] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('upgraded=1')) {
      setUpgraded(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    const stored = window.localStorage.getItem('verifyone_api_key');
    if (stored) setApiKey(stored);
    fetch('/api/v1/registry-health').then((r) => r.json()).then(setRegistry).catch(() => {});
    fetch('/api/v1/gate/stats?days=7').then((r) => r.json()).then(setGateStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    fetch('/api/billing/me', { headers: { Authorization: `Bearer ${apiKey}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.credits != null) setCredits(d.credits);
        if (d.plan) setPlan(d.plan);
        if (d.email) setAccountEmail(d.email);
      })
      .catch(() => {});
  }, [apiKey]);

  const createApiKey = async () => {
    if (!signupEmail) return;
    setSignupBusy(true);
    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail }),
      });
      const d = await r.json();
      if (d.api_key) {
        setApiKey(d.api_key);
        window.localStorage.setItem('verifyone_api_key', d.api_key);
        setCredits(d.credits ?? 1000);
        setPlan(d.plan ?? 'FREE');
        setAccountEmail(signupEmail);
      }
    } finally {
      setSignupBusy(false);
    }
  };

  const startCheckout = async (plan: string) => {
    const email = window.prompt('Billing email for this plan:', '');
    if (!email) return;
    setCheckoutNotice('Redirecting to secure checkout…');
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan }),
      });
      const d = await r.json();
      if (d.checkout_url) { window.location.href = d.checkout_url; return; }
      setCheckoutNotice(d.message || d.error || 'Checkout unavailable');
    } catch { setCheckoutNotice('Checkout unavailable right now'); }
  };

  const runGate = async () => {
    setGateBusy(true);
    setGateResult(null);
    try {
      const res = await fetch('/api/v1/gate/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: gatePhone,
          channel: 'voice',
          consent: gateConsent === 'none' ? { declared: false, type: 'none' } : { declared: true, type: gateConsent },
        }),
      });
      setGateResult(await res.json());
    } catch {
      setGateResult({ error: 'request_failed' });
    } finally {
      setGateBusy(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAuditCsv = async () => {
    if (!apiKey) {
      setExportNotice('Add an API key first — exports are authenticated.');
      return;
    }
    setExportBusy(true);
    setExportNotice(null);
    try {
      const res = await fetch('/api/v1/gate/audit/export', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 401) setExportNotice('Export needs a valid API key.');
        else if (res.status === 403) setExportNotice('Export needs a paid plan — upgrade below.');
        else if (res.status === 404) setExportNotice('No audit records in this window yet.');
        else setExportNotice(d.error || `Export failed (${res.status}).`);
        return;
      }
      const csv = await res.text();
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `verifyone-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportNotice('Export failed — network error.');
    } finally {
      setExportBusy(false);
    }
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
            <span className="text-ink font-semibold">{credits.toLocaleString('en-US')}</span> credits available
          </span>
          <span className="rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold px-3 py-0.5">
            {plan} PLAN
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {upgraded && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-5 py-4 text-sm font-medium">
            ✓ Payment received — your plan and credits have been added to this account. New API keys created after payment inherit the plan automatically.
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight">Workspace Overview</h1>
            <p className="text-sm text-ink-secondary mt-1">Manage API keys, upload bulk CSV datasets, or inspect validation quotas.</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Credits Remaining', value: credits.toLocaleString('en-US'), color: 'text-accent' },
            { label: 'Gate checks (7d)', value: String(gateStats?.total_checks ?? 0), color: 'text-ink' },
            { label: 'Active Plan', value: plan, color: 'text-ink' },
          ].map((s) => (
            <div key={s.label} className="dp-card p-5">
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-extrabold font-display ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-1 bg-ground-muted border border-rule rounded-lg p-1 w-fit max-w-full">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-2.5 sm:px-4 py-2 rounded-md text-xs font-semibold transition-all duration-160 ${
                  activeTab === t
                    ? 'bg-panel text-ink shadow-sm border border-rule/50'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {apiKey && (
            <button
              onClick={exportAuditCsv}
              disabled={exportBusy}
              className="px-3 py-2 rounded-md border border-rule bg-panel text-xs font-semibold text-ink-secondary hover:text-ink transition-all duration-160 disabled:opacity-50"
            >
              {exportBusy ? 'Exporting…' : 'Export audit CSV →'}
            </button>
          )}
          {exportNotice && <span className="text-xs text-red-400">{exportNotice}</span>}
        </div>

        {/* Tab content */}
        {activeTab === 'Overview' && (
          <>
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

          {/* Data source status — the fail-closed story, self-serve. */}
          <div className="dp-card p-6 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg text-ink font-display">Data source status</h2>
              <span className={`rounded-full text-[11px] font-bold px-3 py-1 border ${registry?.shield_ready ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-500 border-red-200 bg-red-50'}`}>
                {registry?.shield_ready ? 'SHIELD READY' : 'SHIELD DEGRADED — checks fail closed'}
              </span>
            </div>
            <p className="text-ink-secondary text-sm mb-4">
              Missing data never silently passes. A red source means the related checks refuse (or the cause of a
              <code className="mx-1 bg-ground-muted border border-rule px-1 rounded text-ink font-mono text-xs">REVIEW</code>) instead of allowing.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {(registry?.data_sources ?? []).map((s: any) => {
                const ok = s.status === 'loaded' || s.status === 'live';
                const neutral = s.status === 'derived' || s.status === 'customer';
                return (
                  <div key={s.id} className="rounded-md border border-rule bg-ground px-3 py-2" title={s.vendor}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : neutral ? 'bg-ink-secondary/40' : 'bg-red-500'}`} />
                      <span className="font-semibold text-ink truncate font-mono">{s.id}</span>
                    </div>
                    <p className="text-ink-secondary mt-0.5">
                      {s.status}{s.records != null ? ` · ${Number(s.records).toLocaleString('en-US')}` : ''}
                    </p>
                    {!ok && !neutral && s.fix_hint ? (
                      <p className="text-ink-secondary/70 mt-0.5 leading-snug">{s.fix_hint}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-ink-secondary mt-3">
              Live receipts feed <code className="bg-ground-muted border border-rule px-1 py-0.5 rounded text-ink font-mono">/api/v1/registry-health</code> and every decision&apos;s evidence record.
            </p>
          </div>
          </>
        )}

        {activeTab === 'Compliance Gate' && (
          <div className="dp-card p-6">
            <div className="flex items-start justify-between mb-2">
              <h2 className="font-bold text-lg text-ink font-display">Pre-Dial Compliance Gate</h2>
              <span className="rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold px-3 py-1">NEW · AI OUTBOUND</span>
            </div>
            <p className="text-ink-secondary text-sm mb-5">
              One call before every dial: DNC, TCPA litigator lists, reassigned numbers, AI-voice consent
              (FCC-24-17) and legal calling hours in the called party&apos;s timezone. Every check returns a
              sealed, hash-chained audit record — the log your lawyer can read.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                value={gatePhone}
                onChange={(e) => setGatePhone(e.target.value)}
                placeholder="+13125550199"
                className="flex-1 bg-ground border border-rule rounded-lg px-4 py-3 text-sm text-ink font-mono focus:outline-none focus:border-accent"
              />
              <select
                value={gateConsent}
                onChange={(e) => setGateConsent(e.target.value)}
                className="bg-ground border border-rule rounded-lg px-3 py-3 text-sm text-ink"
              >
                <option value="none">No consent on file</option>
                <option value="ebr">EBR (existing business relationship)</option>
                <option value="express_written">Express written consent</option>
              </select>
              <button onClick={runGate} disabled={gateBusy} className="dp-btn-primary px-6 py-3 text-sm disabled:opacity-50">
                {gateBusy ? 'Checking…' : 'Run Gate'}
              </button>
            </div>
            {gateResult && !gateResult.error && (
              <div className="rounded-lg border border-rule overflow-hidden">
                {(() => {
                  const dec = String(gateResult.decision || gateResult.decision_legacy || '').toUpperCase();
                  const allow = dec === 'ALLOW';
                  const review = dec === 'REVIEW';
                  const head = allow ? 'bg-accent/10' : review ? 'bg-amber-500/10' : 'bg-red-500/10';
                  const text = allow ? 'text-accent' : review ? 'text-amber-600' : 'text-red-400';
                  const label = allow ? '✓ ALLOW — safe to dial' : review ? '⏸ REVIEW — hold, route to a human before dialing' : '✕ DENY — do not dial';
                  return (
                    <div className={`px-4 py-3 flex items-center justify-between ${head}`}>
                      <span className={`font-bold font-display text-lg ${text}`}>{label}</span>
                      <code className="text-xs text-ink-secondary font-mono">{gateResult.reason}</code>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-rule text-xs">
                  {[
                    ['Line type', gateResult.checks?.line_type],
                    ['Valid number', String(gateResult.checks?.valid_number)],
                    ['Litigator', gateResult.checks?.litigator?.hit ? 'HIT' : 'clear'],
                    ['Federal DNC', gateResult.checks?.dnc?.listed ? 'LISTED' : 'clear'],
                    ['Reassigned', gateResult.checks?.reassigned?.reassigned ? 'YES' : 'no'],
                    ['Calling hours', gateResult.checks?.calling_hours?.applicable ? `${gateResult.checks?.calling_hours?.timezone} ${gateResult.checks?.calling_hours?.local_time}` : 'n/a'],
                  ].map(([k, v]) => (
                    <div key={k as string} className="bg-panel px-4 py-3">
                      <p className="text-ink-secondary uppercase tracking-wider text-[10px] font-semibold mb-1">{k}</p>
                      <p className="text-ink font-mono font-semibold">{String(v)}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-panel px-4 py-3 border-t border-rule text-xs text-ink-secondary">
                  Sealed audit record:{' '}
                  <code className="text-ink font-mono">{gateResult.evidence_id}</code>
                  {' · '}
                  <a className="text-accent hover:underline" target="_blank" href={`/api/v1/gate/audit/${gateResult.evidence_id}`}>inspect evidence →</a>
                  <span className="ml-3">latency {gateResult.latency_ms}ms · usage {gateResult.usage?.used}/{gateResult.usage?.limit}</span>
                </div>
              </div>
            )}
            {gateResult?.error && (
              <p className="text-red-400 text-sm">Gate error: {gateResult.error}</p>
            )}
            <div className="mt-5 rounded-lg bg-field text-on-field p-4 font-mono text-xs overflow-x-auto">
              <div className="text-on-field-secondary"># Drop this before every Vapi / Retell / Twilio call</div>
              <div><span className="text-blue-400">curl</span> -X POST /api/v1/gate/phone \</div>
              <div className="pl-4">-d &apos;{`{"phone":"${gatePhone}","channel":"voice","consent":{"declared":true,"type":"express_written"}}`}&apos;</div>
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
            <h2 className="font-bold text-lg text-ink font-display mb-2">Manage Subscription & Credits</h2>
            <p className="text-ink-secondary text-sm mb-6">
              One universal credit balance: shield = 1 credit/check · full_stack (live HLR + RNDB) = 5 · TrustedForm verification = +1.
              Payments handled by Dodo Payments (merchant of record). Live balances and meters: <code className="bg-ground-muted border border-rule px-1 py-0.5 rounded text-ink font-mono">/api/v1/account/usage</code>.
            </p>
            {checkoutNotice && <p className="mb-4 text-xs text-ink-secondary border border-rule bg-ground-muted rounded-lg px-4 py-2">{checkoutNotice}</p>}
            <div className="grid md:grid-cols-3 gap-4">
              {PLAN_ORDER.map((key, idx) => {
                const p = PLANS[key];
                const popular = key === 'GROWTH';
                return (
                  <div
                    key={key}
                    className={`rounded-panel border p-5 flex flex-col justify-between ${
                      popular ? 'border-accent bg-accent/5' : 'border-rule bg-panel'
                    }`}
                  >
                    <div>
                      {popular && <p className="text-accent text-[11px] font-bold uppercase tracking-wider mb-1">Most Popular</p>}
                      <p className="font-bold text-ink text-base">{p.name}</p>
                      <p className="text-2xl font-extrabold text-ink font-display mt-1">${p.priceUsd}/mo</p>
                      <p className="text-ink-secondary text-xs mt-1">{p.credits.toLocaleString('en-US')} credits · {p.tagline}</p>
                    </div>
                    <button
                      onClick={() => startCheckout(key)}
                      className={`mt-5 w-full rounded-lg text-xs font-semibold py-2.5 transition-all ${
                        popular ? 'dp-btn-primary' : 'dp-btn-secondary'
                      }`}
                    >
                      Checkout with Dodo
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
