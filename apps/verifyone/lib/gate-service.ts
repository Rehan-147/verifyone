import { runPhoneGate, type GateChecks, type GateResult } from './gate';
import {
  createReviewItem,
  findApprovalById,
  consumeApproval,
  APPROVABLE_REVIEW_REASONS,
  DISPUTEABLE_DENY_REASONS,
} from './reviews';
import { normalizePhone, sha256 } from './audit-store';
import { releaseAttempt, reserveAttempt } from './frequency';

/** REVIEW reasons where the only safe action is to retry — never a review item or approval. */
const RETRY_ONLY_REVIEW_REASONS = new Set(['internal_dnc_unavailable', 'frequency_check_unavailable']);

type ReservableResult = {
  decision: 'allow' | 'review' | 'block';
  reason: string;
  risk_score: number;
  checks: GateChecks;
};

/**
 * Record a call attempt for an ALLOW that will lead to a real call, atomically re-checking the
 * frequency cap. If a concurrent request took the last slot, the ALLOW becomes the cap DENY.
 * If the attempt ledger is unavailable, the call is held (REVIEW, retry) — never a silent ALLOW.
 */
export async function applyAttemptReservation<T extends ReservableResult>(
  result: T,
  opts: { ownerKey: string | null | undefined; phone: string; source: 'gate' | 'dial' | 'mcp' },
): Promise<T & { _attemptId?: string; retry_after_seconds?: number }> {
  if (!opts.ownerKey || result.decision !== 'allow') return result;
  const freq = result.checks?.frequency;
  try {
    const r = await reserveAttempt({ ownerKey: opts.ownerKey, phone: opts.phone, limit: freq?.limit ?? null, source: opts.source });
    if (r.reserved) {
      if (freq) result.checks.frequency = { ...freq, attempt_recorded: true };
      return Object.assign(result, { _attemptId: r.attemptId ?? undefined });
    }
    result.checks.frequency = { ...(freq ?? { evaluated: true, limit: null, source: null }), attempts_24h: r.attempts, exceeded: true, attempt_recorded: false } as GateChecks['frequency'];
    return Object.assign(result, {
      decision: 'block' as const,
      reason: freq?.source?.startsWith('state:') ? 'state_frequency_cap' : 'frequency_cap',
      risk_score: 50,
    });
  } catch {
    return Object.assign(result, {
      decision: 'review' as const,
      reason: 'frequency_check_unavailable',
      risk_score: 55,
      retry_after_seconds: 30,
    });
  }
}

export type PhoneGateBody = Record<string, unknown> & {
  phone?: unknown;
  consent?: unknown;
  profile?: string;
  live_hlr?: boolean;
  debug_now?: string;
  mode?: string;
  channel?: string;
  ownerKey?: string | null;
  approval_id?: string | null;
  /**
   * Record this decision as a call attempt for frequency caps when it is ALLOW.
   * Set by callers that dial (gate/phone by default, dial-through); bulk audits leave it off.
   */
  count_attempt?: boolean;
  /** Ledger label for the recorded attempt. */
  attempt_source?: 'gate' | 'dial' | 'mcp';
};

// The set of reasons that an approval can waive.
const WAIVABLE_REASONS = new Set([...APPROVABLE_REVIEW_REASONS, ...DISPUTEABLE_DENY_REASONS]);

/** Shared decision runner; preserves the phone route's existing timeout fallback contract. */
export async function runPhoneGateDecision(body: PhoneGateBody, profile: string, timeoutMs: number) {
  const phone = String(body.phone ?? '');
  const ownerKey = body.ownerKey ?? null;
  const approvalId = typeof body.approval_id === 'string' ? body.approval_id : null;
  const countAttempt = body.count_attempt === true && !!ownerKey;
  const attemptSource = body.attempt_source ?? 'gate';

  // ── Approval-id path ──────────────────────────────────────────────────────
  // Only authenticated callers with a valid approval_id enter this path.
  // We load the approval by id, verify it belongs to this owner+phone, then
  // run the full gate with a waiver for exactly that one reason.
  // The approval is consumed ONLY if the gate returns ALLOW — if another blocker
  // is hit, the approval remains unused and we return the new blocking reason.
  let approvalStatus: string | undefined;

  if (approvalId && ownerKey) {
    const normalized = normalizePhone(phone);
    const phoneHash = sha256(normalized);

    // Load the approval item (must belong to same owner)
    const approval = await findApprovalById(approvalId, ownerKey);

    if (!approval) {
      // Not found or belongs to a different owner
      approvalStatus = 'invalid';
    } else if (approval.phoneHash !== phoneHash) {
      // Approval is for a different phone number
      approvalStatus = 'mismatch';
    } else if (approval.status !== 'approved') {
      approvalStatus = approval.status === 'expired' ? 'expired' : `invalid_status_${approval.status}`;
    } else if (approval.approvalExpiresAt == null || new Date(approval.approvalExpiresAt) <= new Date()) {
      approvalStatus = 'expired';
    } else if (approval.approvalUsedAt != null) {
      approvalStatus = 'already_used';
    } else if (!WAIVABLE_REASONS.has(approval.reason)) {
      // The stored reason is not waivable (defence in depth)
      approvalStatus = 'not_waivable';
    } else {
      // Valid approval — run the gate with a waiver for this reason
      const waive = { reason: approval.reason, approval_id: approvalId };

      const gateResult = await Promise.race([
        runPhoneGate({
          phone,
          channel: body.channel === 'sms' ? 'sms' : 'voice',
          consent: body.consent as { declared?: boolean; type?: 'express_written' | 'ebr' | 'none' },
          mode: body.mode === 'fail_open' ? 'fail_open' : 'fail_closed',
          debug_now: body.debug_now,
          profile: profile as 'ai_outbound_shield' | 'full_stack',
          live_hlr: body.live_hlr === true,
          ownerKey,
          waive,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('gate_timeout')), timeoutMs)),
      ]).catch(() => {
        if (body.mode === 'fail_open') {
          return {
            decision: 'allow' as const,
            reason: 'fail_open_gate_unavailable',
            mode: 'fail_open',
            degraded: true,
            profile: profile as 'ai_outbound_shield' | 'full_stack',
            upstream_live: false,
            checks: {
              valid_number: false,
              line_type: 'unknown' as const,
              disconnected: false,
              litigator: { hit: false },
              dnc: { listed: false, source: 'unavailable' },
              reassigned: { reassigned: false, status: 'unavailable' as const },
              consent: {
                declared: !!(body.consent as { declared?: boolean } | undefined)?.declared,
                type: (body.consent as { type?: string } | undefined)?.type || 'none',
                sufficient_for_ai: (body.consent as { type?: string } | undefined)?.type === 'express_written',
              },
              calling_hours: { applicable: false },
            },
            verified_at: new Date().toISOString(),
            fresh_for_hours: 1,
            evidence_id: '',
            risk_score: 50,
          };
        }
        return {
          decision: 'block' as const,
          reason: 'gate_unavailable_fail_closed',
          mode: 'fail_closed',
          degraded: true,
          profile: profile as 'ai_outbound_shield' | 'full_stack',
          upstream_live: false,
          checks: {} as GateChecks,
          verified_at: new Date().toISOString(),
          fresh_for_hours: 1,
          evidence_id: '',
          risk_score: 50,
        };
      }) as GateResult & { mode: string; degraded: boolean; profile: 'ai_outbound_shield' | 'full_stack'; upstream_live: boolean; data_sources?: import('./data-sources').DataSourceReceipt[] };

      // Reserve the call attempt BEFORE consuming the approval, so a frequency cap reached by a
      // concurrent request never burns a one-time approval.
      let attemptId: string | undefined;
      if (gateResult.decision === 'allow' && countAttempt) {
        const reserved = await applyAttemptReservation(gateResult, { ownerKey, phone, source: attemptSource });
        attemptId = reserved._attemptId;
      }

      if (gateResult.decision === 'allow') {
        // The waiver cleared the only blocker — consume the approval atomically
        const consumption = await consumeApproval({
          id: approvalId,
          ownerKey,
          phone,
          resolvedBy: ownerKey,
          gateEvidenceId: gateResult.evidence_id || '',
        });

        if (consumption.consumed) {
          // Consumption won — return ALLOW with approved_after_review
          return Object.assign(gateResult, {
            decision: 'allow' as const,
            reason: 'approved_after_review',
            _approvalConsumed: true,
            _approvalEvidenceId: consumption.evidence_id,
            _approvalStatus: 'consumed',
            _reviewedBy: approval.resolvedBy,
          });
        } else {
          // Concurrent consumption — another caller already consumed it.
          // Give back the attempt we reserved; the normal run below reserves again if it allows.
          await releaseAttempt(attemptId).catch(() => undefined);
          approvalStatus = 'already_used';
        }
      } else {
        // Another blocker was hit even with the waiver — approval NOT consumed
        approvalStatus = 'other_blocker';

        // Auto-create a review item if the new block is a REVIEW decision for an authenticated caller
        let review_id: string | undefined;
        if (gateResult.decision === 'review' && ownerKey && !RETRY_ONLY_REVIEW_REASONS.has(gateResult.reason)) {
          try {
            const { toPublicReason } = await import('./gate-contract');
            const publicReason = toPublicReason(gateResult.reason, gateResult.checks);
            const item = await createReviewItem({
              ownerKey,
              kind: 'review',
              gateEvidenceId: gateResult.evidence_id || '',
              phone,
              reason: gateResult.reason,
              publicReason,
            });
            review_id = item.id;
          } catch {
            // non-fatal
          }
        }

        return Object.assign(gateResult, {
          approval_status: 'other_blocker',
          ...(review_id ? { review_id } : {}),
        });
      }
    }
  }

  // ── Normal gate run (no approval waiver) ──────────────────────────────────
  const result = await Promise.race([
    runPhoneGate({
      phone,
      channel: body.channel === 'sms' ? 'sms' : 'voice',
      consent: body.consent as { declared?: boolean; type?: 'express_written' | 'ebr' | 'none' },
      mode: body.mode === 'fail_open' ? 'fail_open' : 'fail_closed',
      debug_now: body.debug_now,
      profile: profile as 'ai_outbound_shield' | 'full_stack',
      live_hlr: body.live_hlr === true,
      ownerKey,
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('gate_timeout')), timeoutMs)),
  ]).catch(() => {
    if (body.mode === 'fail_open') {
      return {
        decision: 'allow' as const,
        reason: 'fail_open_gate_unavailable',
        mode: 'fail_open',
        degraded: true,
        profile: profile as 'ai_outbound_shield' | 'full_stack',
        upstream_live: false,
        checks: {
          valid_number: false,
          line_type: 'unknown' as const,
          disconnected: false,
          litigator: { hit: false },
          dnc: { listed: false, source: 'unavailable' },
          reassigned: { reassigned: false, status: 'unavailable' as const },
          consent: {
            declared: !!(body.consent as { declared?: boolean } | undefined)?.declared,
            type: (body.consent as { type?: string } | undefined)?.type || 'none',
            sufficient_for_ai: (body.consent as { type?: string } | undefined)?.type === 'express_written',
          },
          calling_hours: { applicable: false },
        },
        verified_at: new Date().toISOString(),
        fresh_for_hours: 1,
        evidence_id: '',
        risk_score: 50,
      };
    }
    return {
      decision: 'block' as const,
      reason: 'gate_unavailable_fail_closed',
      mode: 'fail_closed',
      degraded: true,
      profile: profile as 'ai_outbound_shield' | 'full_stack',
      upstream_live: false,
      checks: {} as GateChecks,
      verified_at: new Date().toISOString(),
      fresh_for_hours: 1,
      evidence_id: '',
      risk_score: 50,
    };
  }) as GateResult & { mode: string; degraded: boolean; profile: 'ai_outbound_shield' | 'full_stack'; upstream_live: boolean; data_sources?: import('./data-sources').DataSourceReceipt[] };

  // ── Record the call attempt for frequency caps (may turn ALLOW into a cap DENY) ──
  if (countAttempt) {
    await applyAttemptReservation(result, { ownerKey, phone, source: attemptSource });
  }

  // ── Auto-create review item for authenticated REVIEW decisions ────────────
  // Skip retry-only reasons (opt-out list or attempt ledger unreadable): return retry_after instead.
  let review_id: string | undefined;
  let retry_after_seconds: number | undefined;

  if (result.decision === 'review' && ownerKey) {
    if (RETRY_ONLY_REVIEW_REASONS.has(result.reason)) {
      retry_after_seconds = 30;
      // Do NOT create a review item — the only safe action is to retry.
    } else {
      try {
        const { toPublicReason } = await import('./gate-contract');
        const publicReason = toPublicReason(result.reason, result.checks);
        const item = await createReviewItem({
          ownerKey,
          kind: 'review',
          gateEvidenceId: result.evidence_id || '',
          phone,
          reason: result.reason,
          publicReason,
        });
        review_id = item.id;
      } catch {
        // non-fatal: review item creation failure must not break the gate
      }
    }
  }

  return Object.assign(result, {
    ...(review_id ? { review_id } : {}),
    ...(retry_after_seconds != null ? { retry_after_seconds } : {}),
    ...(approvalStatus ? { approval_status: approvalStatus } : {}),
  });
}
