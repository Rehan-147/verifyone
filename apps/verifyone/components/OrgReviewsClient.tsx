'use client';

import { useState, useCallback, useTransition } from 'react';
import type { MaskedReviewItem } from '../lib/reviews';
type Tab = 'open' | 'approved' | 'rejected' | 'expired';

type Props = {
  initialItems: MaskedReviewItem[];
  initialCursor: string | null;
  activeStatus: Tab;
  isAdmin: boolean;
  approvalTtlHours: number;
  orgId: string;
};

function age(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return '<1h ago';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ReasonBadge({ reason }: { reason: string }) {
  return (
    <span className="inline-block text-xs font-mono bg-accent/10 text-accent px-2 py-0.5 rounded">
      {reason}
    </span>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded ${kind === 'dispute' ? 'bg-warning/15 text-warning-dark' : 'bg-ground-raised text-ink-secondary'}`}>
      {kind}
    </span>
  );
}

export default function OrgReviewsClient({
  initialItems,
  initialCursor,
  activeStatus,
  isAdmin,
  approvalTtlHours,
  orgId,
}: Props) {
  const [tab, setTab] = useState<Tab>(activeStatus);
  const [items, setItems] = useState<MaskedReviewItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadTab = useCallback(async (t: Tab) => {
    setTab(t);
    setItems([]);
    setCursor(null);
    setError(null);
    const res = await fetch(`/api/dashboard/reviews?status=${t}`, { credentials: 'include' });
    const data = await res.json();
    setItems(data.items ?? []);
    setCursor(data.next_cursor ?? null);
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await fetch(`/api/dashboard/reviews?status=${tab}&cursor=${cursor}`, { credentials: 'include' });
    const data = await res.json();
    setItems((prev) => [...prev, ...(data.items ?? [])]);
    setCursor(data.next_cursor ?? null);
    setLoadingMore(false);
  }, [cursor, tab]);

  const handleApprove = useCallback(async (id: string) => {
    const note = noteMap[id]?.trim();
    if (!note) { setError('Note is required before approving.'); return; }
    setPendingAction(id);
    setError(null);
    const res = await fetch(`/api/dashboard/reviews/${id}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    setPendingAction(null);
    setConfirmId(null);
    if (!res.ok) { setError(data.error ?? data.message ?? 'Approval failed'); return; }
    setItems((prev) => prev.filter((r) => r.id !== id));
  }, [noteMap]);

  const handleReject = useCallback(async (id: string) => {
    const note = noteMap[id]?.trim();
    if (!note) { setError('Note is required before rejecting.'); return; }
    setPendingAction(id);
    setError(null);
    const res = await fetch(`/api/dashboard/reviews/${id}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    setPendingAction(null);
    setConfirmId(null);
    if (!res.ok) { setError(data.error ?? data.message ?? 'Rejection failed'); return; }
    setItems((prev) => prev.filter((r) => r.id !== id));
  }, [noteMap]);

  const TABS: Tab[] = ['open', 'approved', 'rejected', 'expired'];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => loadTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${tab === t ? 'border-b-2 border-accent text-accent' : 'text-ink-secondary hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="dp-card border border-error/30 bg-error/5 text-error px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-16 text-ink-secondary text-sm">No {tab} review items.</div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="dp-card p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-ink">{item.phoneMasked}</span>
                  <ReasonBadge reason={item.publicReason} />
                  <KindBadge kind={item.kind} />
                </div>
                <div className="text-xs text-ink-secondary">
                  Created {age(item.createdAt)}
                  {item.expiresAt && tab === 'open' && ` · expires ${age(item.expiresAt).replace(' ago', '')}`}
                  {item.resolvedBy && ` · resolved by ${item.resolvedBy}`}
                </div>
                {item.note && (
                  <div className="text-xs text-ink-secondary/80 italic">Note: {item.note}</div>
                )}
                {item.status === 'approved' && item.approvalExpiresAt && (
                  <div className="text-xs text-success">
                    Approval {item.approvalUsedAt ? 'used' : `expires ${age(item.approvalExpiresAt)}`}
                  </div>
                )}
              </div>

              {/* Admin actions — only on open items */}
              {isAdmin && tab === 'open' && (
                <div className="flex flex-col gap-2 min-w-[220px]">
                  <textarea
                    rows={2}
                    placeholder="Resolution note (required)…"
                    value={noteMap[item.id] ?? ''}
                    onChange={(e) => setNoteMap((m) => ({ ...m, [item.id]: e.target.value }))}
                    className="dp-input text-xs resize-none"
                  />
                  {confirmId === item.id ? (
                    <div className="space-y-1">
                      <p className="text-xs text-ink-secondary">
                        This approval is <strong>one-time</strong> and expires in {approvalTtlHours}h. Any other blocker (new opt-out, quiet hours, etc.) will still block.
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={pendingAction === item.id}
                          onClick={() => handleApprove(item.id)}
                          className="dp-btn dp-btn-primary text-xs"
                        >
                          {pendingAction === item.id ? 'Approving…' : 'Confirm Approve'}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="dp-btn text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmId(item.id)}
                        className="dp-btn dp-btn-primary text-xs"
                      >
                        Approve
                      </button>
                      <button
                        disabled={pendingAction === item.id}
                        onClick={() => handleReject(item.id)}
                        className="dp-btn text-xs"
                      >
                        {pendingAction === item.id ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Evidence link */}
            <div className="text-xs font-mono text-ink-secondary/60">
              gate evidence: {item.gateEvidenceId}
              {item.resolutionEvidenceId && ` · resolution: ${item.resolutionEvidenceId}`}
            </div>
          </div>
        ))}
      </div>

      {cursor && (
        <button
          disabled={loadingMore}
          onClick={loadMore}
          className="dp-btn w-full text-sm"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
