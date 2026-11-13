// Public API contract for AI voice agents (Vapi, Retell, MCP).
// Internal gate still uses allow|block + snake_case reasons for audit storage.
import type { GateChecks, GateResult } from './gate';

export type PublicDecision = 'ALLOW' | 'DENY' | 'REVIEW';
export type PublicReason =
  | 'PASS'
  | 'ACTIVE_HLR'
  | 'LITIGATOR_TRAP'
  | 'DNC_NATIONAL_VIOLATION'
  | 'REASSIGNED_NUMBER'
  | 'TCPA_AI_VOICE_CONSENT'
  | 'CONSENT_CERT_INVALID'
  | 'CONSENT_CERT_UNVERIFIED'
  | 'RNDB_UNAVAILABLE'
  | 'QUIET_HOURS'
  | 'DISCONNECTED'
  | 'INVALID_NUMBER'
  | 'GATE_UNAVAILABLE' | 'REGISTRY_UNAVAILABLE';

export type PublicGatePayload = {
  decision: PublicDecision;
  reason: PublicReason;
  evidence_id: string;
  /** Legacy fields — keep for existing integrations during migration */
  decision_legacy?: 'allow' | 'review' | 'block';
  reason_legacy?: string;
  checks?: GateChecks;
  risk_score?: number;
  latency_ms?: number;
  profile?: string;
  bundle_credits?: number;
  priority?: { litigator_scrub: boolean; dnc_scrub: boolean };
  data_sources?: import('./data-sources').DataSourceReceipt[];
  shield_ready?: boolean;
  latency_budget_ms?: number;
  within_budget?: boolean;
};

export function toPublicDecision(internal: 'allow' | 'review' | 'block'): PublicDecision {
  if (internal === 'allow') return 'ALLOW';
  if (internal === 'review') return 'REVIEW';
  return 'DENY';
}

export function toPublicReason(
  internalReason: string,
  checks: GateChecks,
  opts?: { live_hlr?: boolean; upstream_live?: boolean },
): PublicReason {
  switch (internalReason) {
    case 'litigator_list':
      return 'LITIGATOR_TRAP';
    case 'do_not_call_no_consent':
      return 'DNC_NATIONAL_VIOLATION';
    case 'reassigned_number_consent_required':
      return 'REASSIGNED_NUMBER';
    case 'ai_voice_consent_required':
      return 'TCPA_AI_VOICE_CONSENT';
    case 'consent_cert_invalid':
      return 'CONSENT_CERT_INVALID';
    case 'consent_cert_unverified':
      return 'CONSENT_CERT_UNVERIFIED';
    case 'reassigned_check_unavailable':
      return 'RNDB_UNAVAILABLE';
    case 'quiet_hours':
      return 'QUIET_HOURS';
    case 'disconnected':
      return 'DISCONNECTED';
    case 'invalid_number':
      return 'INVALID_NUMBER';
    case 'registry_unavailable_fail_closed':
      return 'REGISTRY_UNAVAILABLE';
    case 'gate_unavailable_fail_closed':
    case 'fail_open_gate_unavailable':
      return 'GATE_UNAVAILABLE';
    case 'cleared':
    case 'cleared_landline':
    case 'dnc_but_consent_on_file':
      if (opts?.live_hlr || opts?.upstream_live) return 'ACTIVE_HLR';
      return 'PASS';
    default:
      return internalReason.includes('block') || internalReason.includes('deny') ? 'GATE_UNAVAILABLE' : 'PASS';
  }
}

export function formatPublicGateResponse(
  result: GateResult & { checks: GateChecks; mode?: string; degraded?: boolean },
  extras?: {
    data_sources?: import('./data-sources').DataSourceReceipt[];
    shield_ready?: boolean;
    latency_budget_ms?: number;
    evidence_id?: string;
    latency_ms?: number;
    profile?: string;
    bundle_credits?: number;
    live_hlr?: boolean;
    upstream_live?: boolean;
  },
): PublicGatePayload {
  const decision = toPublicDecision(result.decision);
  const reason = toPublicReason(result.reason, result.checks, {
    live_hlr: extras?.live_hlr,
    upstream_live: extras?.upstream_live,
  });
  return {
    decision,
    reason,
    evidence_id: extras?.evidence_id ?? result.evidence_id ?? '',
    decision_legacy: result.decision,
    reason_legacy: result.reason,
    checks: result.checks,
    risk_score: result.risk_score,
    latency_ms: extras?.latency_ms,
    profile: extras?.profile,
    bundle_credits: extras?.bundle_credits,
    data_sources: extras?.data_sources,
    shield_ready: extras?.shield_ready,
    latency_budget_ms: extras?.latency_budget_ms,
    within_budget: extras?.latency_budget_ms != null && extras?.latency_ms != null ? extras.latency_ms <= extras.latency_budget_ms : undefined,
    priority: {
      litigator_scrub: !!result.checks.litigator?.hit,
      dnc_scrub: !!result.checks.dnc?.listed,
    },
  };
}

export function isAllowDecision(payload: Pick<PublicGatePayload, 'decision' | 'decision_legacy'>): boolean {
  if (payload.decision === 'ALLOW') return true;
  if (payload.decision_legacy === 'allow') return true;
  return false;
}
