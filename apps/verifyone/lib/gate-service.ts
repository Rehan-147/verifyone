import { runPhoneGate, type GateChecks, type GateResult } from './gate';
import { createReviewItem, findUsableApproval, consumeApproval, APPROVABLE_REVIEW_REASONS } from './reviews';
import { normalizePhone } from './audit-store';

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
};

/** Shared decision runner; preserves the phone route's existing timeout fallback contract. */
export async function runPhoneGateDecision(body: PhoneGateBody, profile: string, timeoutMs: number) {
  const phone = String(body.phone ?? '');
  const ownerKey = body.ownerKey ?? null;
  const approvalId = typeof body.approval_id === 'string' ? body.approval_id : null;

  // If an approval_id is provided, check it BEFORE running the gate so we
  // know what reason we are trying to lift. The gate still runs in full.
  let pendingApproval: import('./reviews').ReviewItem | null = null;
  let approvalStatus: string | undefined;
  if (approvalId && ownerKey) {
    // We'll validate after gate so we know the actual blocking reason.
    // Store the id; validation happens after gate result is known.
  }

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

  // ── Approval-id path ──────────────────────────────────────────────────────
  // If the gate is blocking for exactly one REVIEW-approvable reason and an
  // approval_id was given, check whether we can lift it.
  let review_id: string | undefined;
  let resolvedApproval: { consumed: boolean; evidence_id: string | null; reviewed_by?: string } | undefined;

  if (approvalId && ownerKey) {
    if (result.decision === 'review' && APPROVABLE_REVIEW_REASONS.has(result.reason)) {
      // Find usable approval for this owner + phone + reason
      const approval = await findUsableApproval(ownerKey, phone, result.reason);
      if (!approval) {
        approvalStatus = 'invalid_or_used';
      } else if (approval.id !== approvalId) {
        approvalStatus = 'approval_id_mismatch';
      } else {
        // Try to consume atomically
        const consumption = await consumeApproval({
          id: approvalId,
          ownerKey,
          phone,
          resolvedBy: ownerKey,
          gateEvidenceId: result.evidence_id || '',
        });
        if (consumption.consumed) {
          resolvedApproval = { ...consumption, reviewed_by: approval.resolvedBy ?? 'unknown' };
          // Override the result to ALLOW
          return {
            ...result,
            decision: 'allow' as const,
            reason: 'approved_after_review',
            _approvalConsumed: true,
            _approvalEvidenceId: consumption.evidence_id,
            _approvalStatus: 'consumed',
            _reviewedBy: approval.resolvedBy,
          } as typeof result & Record<string, unknown>;
        } else {
          approvalStatus = 'already_used';
        }
      }
    } else if (result.decision === 'allow') {
      approvalStatus = 'not_needed';
    } else {
      approvalStatus = 'other_blocker';
    }
  }

  // ── Auto-create review item for authenticated REVIEW decisions ────────────
  if (result.decision === 'review' && ownerKey) {
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

  return Object.assign(result, {
    ...(review_id ? { review_id } : {}),
    ...(approvalStatus ? { approval_status: approvalStatus } : {}),
  });
}
