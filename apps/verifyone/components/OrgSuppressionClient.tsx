'use client';

import { useState } from 'react';
import type { MaskedSuppressionItem } from '../lib/suppression';

export default function OrgSuppressionClient({
  initialItems,
  initialCursor,
  isAdmin,
}: {
  initialItems: MaskedSuppressionItem[];
  initialCursor: string | null;
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<MaskedSuppressionItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('manual');
  const [csvText, setCsvText] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [removePhone, setRemovePhone] = useState('');
  const [removeReason, setRemoveReason] = useState('');

  async function refresh(nextCursor?: string | null, searchQuery = search) {
    const params = new URLSearchParams();
    if (nextCursor) params.set('cursor', nextCursor);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    const res = await fetch(`/api/dashboard/suppression?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    if (nextCursor) setItems((prev) => [...prev, ...(data.items || [])]);
    else setItems(data.items || []);
    setCursor(data.next_cursor ?? null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/dashboard/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || 'Failed to add number.');
        return;
      }
      setNotice(`Added: ${data.added}, already suppressed: ${data.already_suppressed}, invalid: ${data.invalid}`);
      setPhone('');
      await refresh(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleCsvImport(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/dashboard/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, reason: 'import' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || 'CSV import failed.');
        return;
      }
      setNotice(`CSV import complete — added: ${data.added}, already suppressed: ${data.already_suppressed}, invalid: ${data.invalid}`);
      setCsvText('');
      await refresh(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(e: React.FormEvent) {
    e.preventDefault();
    if (!removePhone.trim() || !removeReason.trim()) {
      setNotice('Phone and removal reason are both required.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/dashboard/suppression', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: removePhone.trim(), reason: removeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || 'Failed to remove suppression.');
        return;
      }
      setNotice(`Removed from suppression list (evidence: ${data.evidence_id}).`);
      setRemovePhone('');
      setRemoveReason('');
      await refresh(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="dp-card p-4 text-xs font-mono text-ink border-accent/40" role="status">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form onSubmit={handleAdd} className="dp-card p-6 space-y-3">
          <h2 className="text-base font-bold text-ink font-display">Add number to internal DNC</h2>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+14155550123"
            className="w-full rounded-lg border border-rule bg-ground px-3 py-2 text-sm text-ink font-mono"
            disabled={busy}
          />
          <div className="flex gap-3">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-rule bg-ground px-3 py-2 text-xs text-ink"
              disabled={busy}
            >
              <option value="manual">manual</option>
              <option value="opt_out">opt_out</option>
              <option value="complaint">complaint</option>
              <option value="legal_request">legal_request</option>
            </select>
            <button type="submit" disabled={busy} className="dp-btn-primary text-xs">
              Suppress number
            </button>
          </div>
        </form>

        <form onSubmit={handleCsvImport} className="dp-card p-6 space-y-3">
          <h2 className="text-base font-bold text-ink font-display">CSV import</h2>
          <textarea
            rows={3}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'phone\n+14155550123\n+14155550124'}
            className="w-full rounded-lg border border-rule bg-ground px-3 py-2 text-xs text-ink font-mono"
            disabled={busy}
          />
          <button type="submit" disabled={busy} className="dp-btn-secondary text-xs">
            Import CSV
          </button>
        </form>
      </div>

      {isAdmin && (
        <div className="dp-card p-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <form onSubmit={handleRemove} className="flex-1 flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[11px] font-mono text-ink-secondary mb-1">Remove phone (exact E.164)</label>
              <input
                type="text"
                value={removePhone}
                onChange={(e) => setRemovePhone(e.target.value)}
                placeholder="+14155550123"
                className="rounded-lg border border-rule bg-ground px-3 py-1.5 text-xs font-mono text-ink"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-mono text-ink-secondary mb-1">Reason (required)</label>
              <input
                type="text"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="Customer re-consented via web form"
                className="w-full rounded-lg border border-rule bg-ground px-3 py-1.5 text-xs text-ink"
              />
            </div>
            <button type="submit" disabled={busy} className="dp-btn-secondary text-xs text-red-600">
              Remove suppression
            </button>
          </form>
          <a href="/api/dashboard/suppression/export" className="dp-btn-primary text-xs whitespace-nowrap">
            Export decrypted CSV
          </a>
        </div>
      )}

      <div className="dp-card p-4 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exact E.164 number (+1...)"
          className="flex-1 rounded-lg border border-rule bg-ground px-3 py-1.5 text-xs font-mono text-ink"
        />
        <button type="button" onClick={() => refresh(null, search)} className="dp-btn-secondary text-xs">
          Search
        </button>
      </div>

      <div className="dp-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ground-muted border-b border-rule">
            <tr>
              <th className="p-3 text-left font-mono text-xs text-ink-secondary uppercase">Phone (masked)</th>
              <th className="p-3 text-left font-mono text-xs text-ink-secondary uppercase">Reason</th>
              <th className="p-3 text-left font-mono text-xs text-ink-secondary uppercase">Source</th>
              <th className="p-3 text-left font-mono text-xs text-ink-secondary uppercase">Requested at</th>
              <th className="p-3 text-left font-mono text-xs text-ink-secondary uppercase">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-xs text-ink-secondary">
                  No active suppression entries.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3 font-mono text-xs text-ink">
                    {item.phoneMasked}
                    {!item.exportable && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-800 border border-amber-500/30">
                        number not exportable
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-ink-secondary">{item.reason}</td>
                  <td className="p-3 font-mono text-xs text-ink-secondary">{item.source}</td>
                  <td className="p-3 text-xs text-ink-secondary">{item.requestedAt.slice(0, 10)}</td>
                  <td className="p-3 font-mono text-xs text-accent">{item.addEvidenceId ?? 'pending'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <div className="text-center">
          <button type="button" onClick={() => refresh(cursor)} className="dp-btn-secondary text-xs">
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
