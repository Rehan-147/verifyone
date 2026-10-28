'use client';

import { useState } from 'react';
import { validatePhone, verifyEmail, ipLookup } from '../lib/validators';
import Link from 'next/link';

type Tab = 'phone' | 'email' | 'ip';

/* ── Inline SVG product diagram: Phone + Email + IP → VerifyOne hub ── */
function HeroDiagram() {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none" aria-hidden="true">
      <svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* Connector lines */}
        <line x1="96" y1="52"  x2="160" y2="140" stroke="#dde0e6" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="160" y1="52"  x2="160" y2="140" stroke="#dde0e6" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="224" y1="52"  x2="160" y2="140" stroke="#dde0e6" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="96" y1="228" x2="160" y2="140" stroke="#dde0e6" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="224" y1="228" x2="160" y2="140" stroke="#dde0e6" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* Input tiles – top row */}
        {[
          { x: 64, y: 16, label: 'Phone' },
          { x: 128, y: 16, label: 'Email' },
          { x: 192, y: 16, label: 'IP' },
        ].map(({ x, y, label }) => (
          <g key={label} transform={`translate(${x},${y})`}>
            <rect width="64" height="36" rx="8" fill="white" stroke="#dde0e6" strokeWidth="1" />
            <text x="32" y="14" textAnchor="middle" fill="#454c58" fontSize="9" fontFamily="Instrument Sans, sans-serif" fontWeight="600" dy="0.35em">{label}</text>
            <text x="32" y="26" textAnchor="middle" fill="#074ce0" fontSize="7" fontFamily="Instrument Sans, sans-serif" dy="0.35em">lookup</text>
          </g>
        ))}

        {/* VerifyOne central hub */}
        <g transform="translate(120,108)">
          {/* glow ring */}
          <circle cx="40" cy="40" r="46" fill="rgba(7,76,224,0.06)" />
          {/* outer ring */}
          <circle cx="40" cy="40" r="40" fill="white" stroke="#dde0e6" strokeWidth="1.5" />
          {/* blue filled center */}
          <circle cx="40" cy="40" r="30" fill="#074ce0" />
          {/* diagonal sheen */}
          <circle cx="40" cy="40" r="30" fill="url(#hubGrad)" opacity="0.3" />
          <text x="40" y="37" textAnchor="middle" fill="white" fontSize="9" fontFamily="Host Grotesk, sans-serif" fontWeight="700" dy="0.35em">Verify</text>
          <text x="40" y="49" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="8" fontFamily="Instrument Sans, sans-serif" dy="0.35em">One</text>
          <defs>
            <radialGradient id="hubGrad" cx="35%" cy="35%">
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="#074ce0" />
            </radialGradient>
          </defs>
        </g>

        {/* Output tiles – bottom row */}
        {[
          { x: 64,  y: 216, label: 'Risk Score', sub: '0–100' },
          { x: 192, y: 216, label: 'Carrier',    sub: 'T-Mobile' },
        ].map(({ x, y, label, sub }) => (
          <g key={label} transform={`translate(${x},${y})`}>
            <rect width="64" height="36" rx="8" fill="white" stroke="#dde0e6" strokeWidth="1" />
            <text x="32" y="14" textAnchor="middle" fill="#454c58" fontSize="9" fontFamily="Instrument Sans, sans-serif" fontWeight="600" dy="0.35em">{label}</text>
            <text x="32" y="26" textAnchor="middle" fill="#074ce0" fontSize="8" fontFamily="Instrument Sans, sans-serif" fontWeight="700" dy="0.35em">{sub}</text>
          </g>
        ))}
      </svg>
      <p className="text-center text-[12px] text-ink-secondary mt-2 font-medium" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
        All 74 data products · One API key · One credit balance
      </p>
    </div>
  );
}

export default function HeroValidator() {
  const [tab, setTab] = useState<Tab>('phone');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [credits, setCredits] = useState(1000);
  const [loading, setLoading] = useState(false);

  const placeholders: Record<Tab, string> = {
    phone: '+1 415 555 2671',
    email: 'alex@company.com',
    ip: '8.8.8.8',
  };

  const run = () => {
    if (!input.trim()) return;
    setLoading(true);
    setTimeout(() => {
      if (tab === 'phone') setResult(validatePhone(input));
      else if (tab === 'email') setResult(verifyEmail(input));
      else setResult(ipLookup(input));
      setCredits((c) => c - 1);
      setLoading(false);
    }, 300);
  };

  const tabs: Tab[] = ['phone', 'email', 'ip'];
  const tabLabels: Record<Tab, string> = { phone: 'Phone', email: 'Email', ip: 'IP Lookup' };

  return (
    <section className="bg-ground py-16 md:py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Hero split: ~1.45 text : 1 diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-12 lg:gap-16 items-center">

          {/* ── Left: Copy + Validator ── */}
          <div>
            <span className="inline-flex items-center gap-2 mb-5 rounded-full border border-rule bg-ground-muted px-3.5 py-1 text-[12px] font-semibold text-ink-secondary tracking-widest uppercase"
              style={{ fontFamily: 'Instrument Sans, sans-serif' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Phone · Email · IP · One API
            </span>

            <h1
              className="text-4xl sm:text-5xl lg:text-[56px] font-bold text-ink leading-[1.1] tracking-[-0.03em] mb-5 max-w-2xl"
              style={{ fontFamily: '"Host Grotesk", sans-serif' }}
            >
              Validate Phone, Email &amp; IP in{' '}
              <span className="text-accent">300ms</span>.<br />
              One API. One Balance.
            </h1>

            <p className="text-[17px] text-ink-secondary leading-relaxed mb-6 max-w-lg" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
              The unified validation platform built for cold-email &amp; lead-gen agencies.
              Stop juggling 5 separate tools and subscriptions.
            </p>

            {/* Stats strip */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 text-[13px] text-ink-secondary border-t border-rule pt-4"
              style={{ fontFamily: 'Instrument Sans, sans-serif' }}
            >
              {[
                { n: '1,200+', label: 'agencies' },
                { n: '74', label: 'data products' },
                { n: '99.98%', label: 'uptime' },
                { n: '7-day', label: 'free trial' },
              ].map(({ n, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="font-bold text-ink text-[15px]" style={{ fontFamily: '"Host Grotesk", sans-serif' }}>{n}</span>
                  <span>{label}</span>
                </span>
              ))}
            </div>

            {/* ── Validator card ── */}
            <div className="dp-card p-5">
              {/* Tab bar */}
              <div className="flex gap-1.5 mb-4 bg-ground-muted rounded-lg p-1">
                {tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setResult(null); setInput(''); }}
                    aria-pressed={tab === t}
                    className={`flex-1 rounded-md py-2 text-[13px] font-semibold transition-[background,color,box-shadow] duration-[160ms] ease-out focus-visible:outline-accent focus-visible:outline-2 ${
                      tab === t
                        ? 'bg-panel text-ink shadow-sm border border-rule'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                    style={{ fontFamily: 'Instrument Sans, sans-serif' }}
                  >
                    {tabLabels[t]}
                  </button>
                ))}
              </div>

              {/* Input + CTA */}
              <div className="flex gap-2 mb-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && run()}
                  placeholder={placeholders[tab]}
                  aria-label={`${tabLabels[tab]} value to validate`}
                  className="flex-1 rounded-lg border border-rule bg-ground px-4 py-2.5 text-[14px] text-ink placeholder-ink-secondary/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-[border-color] duration-[160ms]"
                  style={{ fontFamily: 'Instrument Sans, sans-serif' }}
                />
                <button
                  onClick={run}
                  disabled={loading || !input.trim()}
                  className="dp-btn-primary text-[13px] whitespace-nowrap"
                >
                  {loading ? 'Checking…' : 'Validate — 1 cr'}
                </button>
              </div>

              {/* Credits pill */}
              <div className="flex items-center gap-2 text-[12px] text-ink-secondary" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span><span className="font-semibold text-ink">{credits.toLocaleString()}</span> trial credits remaining</span>
              </div>

              {/* Result */}
              {result && (
                <div className="mt-4 rounded-lg border border-rule bg-ground-muted p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-rule">
                    <span className={`h-2 w-2 rounded-full ${result.valid ? 'bg-accent' : 'bg-red-500'}`} />
                    <span className={`text-[13px] font-semibold ${result.valid ? 'text-accent' : 'text-red-600'}`}
                      style={{ fontFamily: 'Instrument Sans, sans-serif' }}
                    >
                      {result.valid ? 'Valid · Low Risk' : 'Invalid / High Risk'}
                    </span>
                    <span className="ml-auto text-[11px] font-mono text-ink-secondary">42ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 text-[12px]" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
                    {Object.entries(result).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-rule/60">
                        <span className="text-ink-secondary capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-semibold text-ink">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Product diagram ── */}
          <div className="hidden lg:flex flex-col items-center justify-center">
            <HeroDiagram />
          </div>
        </div>
      </div>
    </section>
  );
}
