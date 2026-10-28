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
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* Top nav */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg text-[#A3E635]">VerifyOne</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            <span className="text-white font-semibold">{credits.toLocaleString()}</span> credits
          </span>
          <span className="rounded-full bg-[#A3E635]/10 border border-[#A3E635]/30 text-[#A3E635] text-xs font-semibold px-3 py-1">
            STARTER
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold mb-6">Dashboard</h1>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Credits Remaining', value: credits.toLocaleString(), color: 'text-[#A3E635]' },
            { label: 'Checks Today', value: '0', color: 'text-white' },
            { label: 'Plan', value: 'Starter', color: 'text-white' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t
                  ? 'bg-[#A3E635] text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Overview' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold text-lg mb-4">Quick Validate</h2>
            <p className="text-gray-400 text-sm">
              Use the validator on the{' '}
              <a href="/" className="text-[#A3E635] hover:underline">home page</a>{' '}
              or call the API directly with your key below.
            </p>
            <div className="mt-4 rounded-lg bg-black/30 border border-white/10 p-4 font-mono text-xs text-gray-300">
              <span className="text-gray-500">POST </span>
              <span className="text-[#A3E635]">https://app.verifyone.io/api/v1/validate_phone</span>
              <br />
              <span className="text-gray-500">Authorization: </span>Bearer vk_live_...
            </div>
          </div>
        )}

        {activeTab === 'Bulk CSV' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold text-lg mb-4">Bulk CSV Upload</h2>
            <p className="text-gray-400 text-sm mb-4">
              Upload a CSV with a <code className="bg-white/10 px-1 rounded">phone</code>,{' '}
              <code className="bg-white/10 px-1 rounded">email</code>, or{' '}
              <code className="bg-white/10 px-1 rounded">ip</code> column. First 5 rows previewed below.
            </p>
            <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-white/20 hover:border-[#A3E635]/50 cursor-pointer transition-colors">
              <span className="text-gray-400 text-sm">Click to upload CSV</span>
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
                    const rows = text.split('\n').slice(1, 6).map((l) => ({ raw: l.trim(), status: 'valid' }));
                    setCsvRows(rows);
                    setCredits((c) => c - rows.length);
                  };
                  r.readAsText(f);
                }}
              />
            </label>
            {csvRows.length > 0 && (
              <div className="mt-4 rounded-lg overflow-hidden border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">#</th>
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">Row</th>
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-2 text-gray-300 truncate max-w-xs">{row.raw}</td>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-[#A3E635]/10 text-[#A3E635] text-xs px-2 py-0.5 font-semibold">
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
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold text-lg mb-4">Your API Key</h2>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-[#A3E635] font-mono truncate">
                {apiKey}
              </code>
              <button
                onClick={copyKey}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  copied
                    ? 'bg-[#A3E635] text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Pass as <code className="bg-white/10 px-1 rounded">Authorization: Bearer {'<key>'}</code> on every request.
            </p>
          </div>
        )}

        {activeTab === 'Billing' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold text-lg mb-6">Upgrade your plan</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { name: 'Starter', price: '$149/mo', credits: '30k credits' },
                { name: 'Growth', price: '$449/mo', credits: '120k credits', popular: true },
                { name: 'Pro', price: '$999/mo', credits: '400k credits' },
              ].map((p) => (
                <div
                  key={p.name}
                  className={`rounded-xl border p-5 ${p.popular ? 'border-[#A3E635] bg-[#A3E635]/5' : 'border-white/10'}`}
                >
                  {p.popular && <p className="text-[#A3E635] text-xs font-bold mb-1">MOST POPULAR</p>}
                  <p className="font-bold">{p.name}</p>
                  <p className="text-2xl font-extrabold text-[#A3E635] mt-1">{p.price}</p>
                  <p className="text-gray-400 text-sm mt-1">{p.credits}</p>
                  <button className="mt-4 w-full rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 transition-colors">
                    Select
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
