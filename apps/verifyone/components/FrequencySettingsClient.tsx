'use client';

import { useState } from 'react';

type StateRule = { state: string; maxCalls: number; windowHours: number; citation: string };

export default function FrequencySettingsClient({
  initialCap,
  isAdmin,
  stateRules,
  min,
  max,
}: {
  initialCap: number | null;
  isAdmin: boolean;
  stateRules: StateRule[];
  min: number;
  max: number;
}) {
  const [cap, setCap] = useState<number | null>(initialCap);
  const [value, setValue] = useState(initialCap == null ? '' : String(initialCap));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function save(next: number | null) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/dashboard/settings/frequency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_cap_24h: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.message || data.error || 'Could not save the setting.');
        return;
      }
      setCap(data.call_cap_24h ?? null);
      setValue(data.call_cap_24h == null ? '' : String(data.call_cap_24h));
      setNotice(data.call_cap_24h == null ? 'Account cap removed. State rules still apply.' : `Saved: at most ${data.call_cap_24h} calls to the same number per 24 hours.`);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return save(null);
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      setNotice(`Enter a whole number from ${min} to ${max}, or leave it empty for no account cap.`);
      return;
    }
    return save(parsed);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="dp-card p-6 space-y-3">
          <h2 className="text-base font-bold text-ink font-display">Account call cap</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Limit how many times your organization can call the <strong className="text-ink">same number</strong> in
            a rolling 24 hours. Every gate ALLOW and dial-through call counts as an attempt.
          </p>
          <p className="text-sm text-ink">
            Current: <strong>{cap == null ? 'No account cap' : `${cap} per 24 hours`}</strong>
          </p>
          {isAdmin ? (
            <div className="flex gap-3">
              <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. 3 (empty = none)"
                className="w-40 rounded-lg border border-rule bg-ground px-3 py-2 text-sm text-ink font-mono"
                disabled={busy}
              />
              <button type="submit" disabled={busy} className="dp-btn-primary text-xs">
                Save cap
              </button>
            </div>
          ) : (
            <p className="text-xs text-ink-secondary">Only organization admins can change this setting.</p>
          )}
          {notice && <p className="text-xs text-ink-secondary">{notice}</p>}
        </form>

        <div className="dp-card p-6 space-y-3">
          <h2 className="text-base font-bold text-ink font-display">State rules (always enforced)</h2>
          <p className="text-xs text-ink-secondary leading-relaxed">
            These apply on top of your account cap; the stricter limit wins and cannot be raised.
          </p>
          <ul className="space-y-2">
            {stateRules.map((r) => (
              <li key={r.state} className="text-sm text-ink">
                <strong>{r.state}</strong>: at most {r.maxCalls} calls per {r.windowHours} hours to the same person
                <span className="block text-xs text-ink-secondary font-mono">{r.citation} · pending counsel review</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
