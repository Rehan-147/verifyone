'use client';

import { useState } from 'react';

export type OrgApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export default function OrgApiKeysClient({
  initialKeys,
  isAdmin,
}: {
  initialKeys: OrgApiKeyRow[];
  isAdmin: boolean;
}) {
  const [keys, setKeys] = useState<OrgApiKeyRow[]>(initialKeys);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Key name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    setCreatedKey(null);
    try {
      const res = await fetch('/api/dashboard/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create API key.');
        return;
      }
      setCreatedKey(data.key);
      setKeys((prev) => [data.record, ...prev]);
      setName('');
    } catch {
      setError('Network error while creating API key.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(keyRow: OrgApiKeyRow) {
    if (!window.confirm(`Revoke API key "${keyRow.name}" (${keyRow.prefix}…${keyRow.last4})? Any agent using it will immediately receive HTTP 401.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyRow.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not revoke API key.');
        return;
      }
      const revokedAt = new Date().toISOString();
      setKeys((prev) => prev.map((k) => (k.id === keyRow.id ? { ...k, revokedAt } : k)));
    } catch {
      setError('Network error while revoking API key.');
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <form onSubmit={handleCreate} className="dp-card p-6 space-y-4">
          <h2 className="text-base font-bold text-ink font-display">Create API key</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vapi Production Outbound"
              aria-label="API key name"
              className="flex-1 rounded-lg border border-rule bg-ground px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent"
              disabled={busy}
            />
            <button type="submit" disabled={busy} className="dp-btn-primary text-sm whitespace-nowrap">
              {busy ? 'Creating…' : 'Create key'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </form>
      ) : (
        <div className="dp-card p-5 text-xs text-ink-secondary">
          You are signed in as an organization <strong className="text-ink">member</strong>. Only organization
          admins (<code className="font-mono">org:admin</code>) can create or revoke API keys.
        </div>
      )}

      {createdKey && (
        <div className="dp-card p-6 border-2 border-amber-500/50 bg-amber-500/5 space-y-3" role="status">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-ink">
              Copy your new API key now — you won&apos;t see this again
            </p>
            <button type="button" onClick={copyKey} className="dp-btn-secondary text-xs">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="font-mono text-xs bg-ground border border-rule rounded-lg p-3 overflow-x-auto text-ink select-all">
            {createdKey}
          </pre>
        </div>
      )}

      <div className="dp-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ground-muted border-b border-rule">
            <tr>
              <th className="p-3.5 text-left font-semibold text-ink-secondary text-xs uppercase font-mono">Name</th>
              <th className="p-3.5 text-left font-semibold text-ink-secondary text-xs uppercase font-mono">Key</th>
              <th className="p-3.5 text-left font-semibold text-ink-secondary text-xs uppercase font-mono">Created</th>
              <th className="p-3.5 text-left font-semibold text-ink-secondary text-xs uppercase font-mono">Last used</th>
              <th className="p-3.5 text-left font-semibold text-ink-secondary text-xs uppercase font-mono">Status</th>
              {isAdmin && <th className="p-3.5 text-right font-semibold text-ink-secondary text-xs uppercase font-mono">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {keys.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="p-6 text-center text-ink-secondary text-xs">
                  No API keys created for this organization yet.
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id}>
                  <td className="p-3.5 font-medium text-ink">{k.name}</td>
                  <td className="p-3.5 font-mono text-xs text-ink-secondary">
                    {k.prefix}…{k.last4}
                  </td>
                  <td className="p-3.5 text-xs text-ink-secondary">{k.createdAt.slice(0, 10)}</td>
                  <td className="p-3.5 text-xs text-ink-secondary">
                    {k.lastUsedAt ? k.lastUsedAt.slice(0, 10) : 'Never'}
                  </td>
                  <td className="p-3.5 text-xs">
                    {k.revokedAt ? (
                      <span className="font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-700 border border-red-500/20">
                        Revoked
                      </span>
                    ) : (
                      <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-3.5 text-right">
                      {!k.revokedAt && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRevoke(k)}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
