'use client';
import { useState } from 'react';
import { validatePhone, verifyEmail, ipLookup } from '../lib/validators';

type Tab = 'phone' | 'email' | 'ip';

export default function HeroValidator() {
  const [tab, setTab] = useState<Tab>('phone');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [credits, setCredits] = useState(1000);
  const [loading, setLoading] = useState(false);

  const placeholders: Record<Tab, string> = {
    phone: '+14155552671',
    email: 'test@gmail.com',
    ip: '8.8.8.8',
  };

  const run = () => {
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

  return (
    <section className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-4 py-20">
      {/* Badge */}
      <span className="mb-4 inline-block rounded-full bg-[#A3E635]/10 border border-[#A3E635]/30 px-4 py-1 text-xs font-semibold text-[#A3E635] tracking-widest uppercase">
        Phone · Email · IP · One API
      </span>

      {/* Headline */}
      <h1 className="text-center text-4xl md:text-6xl font-extrabold text-white leading-tight max-w-3xl">
        Validate Phone, Email &amp; IP in{' '}
        <span className="text-[#A3E635]">300ms</span>.
        <br />
        One API. One Credit Balance.
      </h1>

      <p className="mt-4 text-center text-gray-400 text-lg max-w-xl">
        The unified validation API built for cold-email &amp; lead-gen agencies.
        Stop juggling 5 tools.
      </p>

      {/* Credits pill */}
      <div className="mt-6 flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300">
        <span className="h-2 w-2 rounded-full bg-[#A3E635] animate-pulse" />
        <span>
          <span className="font-semibold text-white">{credits.toLocaleString()}</span> credits remaining
        </span>
      </div>

      {/* Validator card */}
      <div className="mt-10 w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setResult(null); setInput(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-all ${
                tab === t
                  ? 'bg-[#A3E635] text-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t === 'ip' ? 'IP Lookup' : t === 'email' ? 'Email' : 'Phone'}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder={placeholders[tab]}
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#A3E635] transition-colors"
          />
          <button
            onClick={run}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-[#A3E635] hover:bg-[#bef264] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-5 py-3 text-sm transition-colors whitespace-nowrap"
          >
            {loading ? '...' : 'Validate — 1 cr'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-5 rounded-lg bg-black/30 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`h-2.5 w-2.5 rounded-full ${result.valid ? 'bg-[#A3E635]' : 'bg-red-400'}`} />
              <span className={`text-sm font-semibold ${result.valid ? 'text-[#A3E635]' : 'text-red-400'}`}>
                {result.valid ? 'Valid' : 'Invalid / High Risk'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {Object.entries(result).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 py-1">
                  <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-white font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trust bar */}
      <p className="mt-8 text-gray-500 text-xs text-center">
        Trusted by 1,200+ agencies · 7-day free trial · No credit card required
      </p>
    </section>
  );
}
