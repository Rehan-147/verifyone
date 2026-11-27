// ============================================================
// VERIFYONE PRE-DIAL GATE  (the 2027 wedge)
// One call answers: "May I place this call RIGHT NOW?" -> allow | block
// Bundles: number validity + line type + disconnected + litigator + DNC
//          + reassigned number + consent (FCC AI-voice rule) + calling hours
// Returns a decision, a reason, per-check details, and a sealed evidence id.
//
// MOCK SOURCES below are deterministic placeholders with the SAME return
// shape as the real upstreams, so swapping them in never breaks callers:
//   - Line type / disconnected:  Telnyx or Twilio Lookup v2 (TODO real keys)
//   - Federal DNC:               FTC registry (30-day file, 64.1200(c)(2))
//   - Litigator:                 DNC.com litigator scrub
//   - Reassigned:                FCC Reassigned Numbers Database (RNDB)
//   - Calling hours:             area-code -> IANA timezone map (real, below)
// ============================================================
import { normalizePhone } from './audit-store';
import { upstreamPhone } from './upstream';
import { litigatorCheck, dncLocalCheck } from './compliance-cache';
import type { GateProfile } from './credits';
import { evaluateShieldReadiness, allowDevMocks } from './compliance-policy';
import { buildDataSourceReceipts } from './compliance-cache';
import { checkReassigned } from './rndb';
import { verifyTrustedForm, extractTrustedFormCertId } from './trustedform';
import type { Account } from './auth';
import { NPA } from './data/npa';
import { STATE_CALLING_RULES } from './data/state-calling-rules';
import { isSuppressed } from './suppression';
import { ownerKeyFor } from './platform-credentials';
import { APPROVABLE_REVIEW_REASONS, DISPUTEABLE_DENY_REASONS } from './reviews';

// The set of reasons that a waiver may legitimately skip (defence in depth).
// If a waive.reason is not in this set it is silently ignored.
const WAIVABLE_REASONS = new Set([...APPROVABLE_REVIEW_REASONS, ...DISPUTEABLE_DENY_REASONS]);

export type GateChecks = {
  valid_number: boolean;
  internal_dnc?: { evaluated: boolean; listed: boolean; entry_requested_at?: string };
  line_type: 'mobile' | 'landline' | 'voip' | 'unknown';
  disconnected: boolean;
  litigator: { hit: boolean; list?: string };
  dnc: { listed: boolean; source: string };
  reassigned: { reassigned: boolean; date?: string; status: 'unavailable' | 'simulated' | 'live' };
  consent: {
    declared: boolean;
    type: string;
    sufficient_for_ai: boolean;
    trustedform?: {
      status: 'verified' | 'invalid' | 'unconfigured' | 'skipped' | 'error';
      cert_id?: string;
      captured_at?: string;
    };
  };
  calling_hours: {
    applicable: boolean;
    timezone?: string;
    local_time?: string;
    timezones?: string[];
    local_times?: string[];
    window?: string;
    window_source?: 'federal' | `state:${string}`;
    allowed?: boolean | null;
    state?: string;
    reason?: 'timezone_unknown';
  };
  /** Set when a waiver was applied to skip exactly one condition. */
  waived?: { reason: string; approval_id: string };
};

export type GateResult = {
  decision: 'allow' | 'review' | 'block';
  reason: string;
  checks: GateChecks;
  verified_at: string;
  fresh_for_hours: number;   // re-check recommendation (freshness promise)
  evidence_id: string;
  risk_score: number;
};

function mockLitigator(phone: string) {
  const local = litigatorCheck(phone);
  if (local.source === 'litigator_file') {
    return { hit: local.hit, list: local.hit ? local.list : undefined };
  }
  if (!allowDevMocks()) {
    return { hit: false, list: undefined };
  }
  const lists = ['TCPA Class: Miller v. VoiceNet', 'Litigator: Kessler Topaz scrub list'];
  const h = hash(phone + '|litigator');
  return { hit: h % 17 === 0, list: h % 17 === 0 ? lists[h % 2] : undefined };
}
function mockDNC(phone: string) {
  const local = dncLocalCheck(phone);
  // Real verdicts from either NANP registry (FTC US / CRTC Canada) pass through;
  // everything else falls to dev mocks or the fail-closed path.
  if (local.source.startsWith('ftc') || local.source.startsWith('crtc')) {
    return { listed: local.listed, source: local.source };
  }
  if (!allowDevMocks()) {
    return { listed: false, source: 'dnc_cache_miss' };
  }
  return { listed: hash(phone + '|dnc') % 5 === 0, source: 'federal_mock' as string };
}
function mockReassigned(phone: string) {
  if (!allowDevMocks()) {
    return { reassigned: false, status: 'unavailable' as const };
  }
  const re = hash(phone + '|rndb') % 23 === 0;
  return { reassigned: re, status: 'simulated' as const, date: re ? '2025-11-04' : undefined };
}

/**
 * Reassigned-number resolution per gate profile.
 * - shield profile: no live RNDB call (latency budget). Dev mocks simulate;
 *   production reports unavailable (the fail-closed review path covers staleness).
 * - full_stack profile: live check via rndb.ts (generic provider or Twilio).
 */
async function reassignedFor(phone: string, liveNow: boolean): Promise<GateChecks['reassigned']> {
  const devSim = mockReassigned(phone);
  if (!liveNow) {
    return allowDevMocks() ? devSim : { reassigned: false, status: 'unavailable' };
  }
  const live = await checkReassigned(phone);
  if (live.status === 'live') {
    return { reassigned: live.reassigned === true, status: 'live', date: live.date };
  }
  if (allowDevMocks()) return devSim;
  return { reassigned: false, status: 'unavailable' };
}
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

function lineTypeFor(n: string): GateChecks['line_type'] {
  if (n.endsWith('9999')) return 'voip';
  if (hash(n) % 6 === 0) return 'landline';
  return 'mobile';
}
function disconnectedFor(n: string) { return n.endsWith('0000000') || hash(n + '|hlr') % 29 === 0; }

function callingHoursFor(n: string, now?: Date) {
  const isNA = n.startsWith('+1') && n.length === 12;
  if (!isNA) return { applicable: false as const };
  const npa = NPA[n.slice(2, 5)];
  if (!npa) {
    return {
      applicable: true as const,
      timezones: [] as string[],
      local_times: [] as string[],
      window: '08:00-21:00',
      window_source: 'federal' as const,
      allowed: null,
      reason: 'timezone_unknown' as const,
    };
  }

  const rule = STATE_CALLING_RULES[npa.state];
  const start = rule?.start ?? '08:00';
  const end = rule?.end ?? '21:00'; // 47 CFR 64.1200(c)(1)
  const timezones = npa.zones;
  const t = now || new Date();
  const local_times = timezones.map((timezone) => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(t));
  const allowed = local_times.every((local) => local >= start && local < end);
  return {
    applicable: true as const,
    timezone: timezones[0],
    local_time: local_times[0],
    timezones,
    local_times,
    window: `${start}-${end}`,
    window_source: rule ? `state:${npa.state}` as const : 'federal' as const,
    allowed,
    state: npa.state,
  };
}

export type GateInput = {
  phone: string;
  channel?: 'voice' | 'sms';
  consent?: {
    declared?: boolean;
    type?: 'express_written' | 'ebr' | 'none';
    ebr_id?: string;
    trustedform_cert_url?: string;
  };
  mode?: 'fail_closed' | 'fail_open';
  debug_now?: string; // dev only: ISO timestamp override to test quiet-hours
  /** Default ai_outbound_shield: local DNC + litigator, no live HLR ping (sub-100ms). */
  profile?: GateProfile;
  live_hlr?: boolean;
  ownerKey?: string | null;
  /**
   * When set by an authenticated approval path, the ladder treats ONLY this one
   * condition as already-passed and continues evaluating every other condition
   * in normal order. Ignored if reason is not in APPROVABLE_REVIEW_REASONS ∪
   * DISPUTEABLE_DENY_REASONS (defence in depth — clients cannot inject a waiver).
   * The approval_id is recorded in checks.waived for the audit trail.
   */
  waive?: { reason: string; approval_id: string };
};

export async function runPhoneGate(input: GateInput): Promise<GateResult & { checks: GateChecks; mode: string; degraded: boolean; profile: GateProfile; upstream_live: boolean; data_sources: import('./data-sources').DataSourceReceipt[] }> {
  const n = normalizePhone(input.phone);
  const now = input.debug_now && process.env.NODE_ENV !== 'production' ? new Date(input.debug_now) : new Date();
  const consentType = input.consent?.type || (input.consent?.declared ? 'ebr' : 'none');
  const profile: GateProfile = input.profile ?? (input.live_hlr ? 'full_stack' : 'ai_outbound_shield');
  const wantLiveHlr = profile === 'full_stack' || input.live_hlr === true;

  // TrustedForm consent-certificate verification. Live network check only on the
  // full_stack profile (latency budget: shield stays sub-100ms); with a cert URL
  // but no key we mark 'unconfigured' instead of pretending the cert was checked.
  const certUrl = input.consent?.trustedform_cert_url?.trim();
  const certId = extractTrustedFormCertId(certUrl) || undefined;
  const tfKey = !!process.env.TRUSTEDFORM_API_KEY?.trim();
  const trustedform: Awaited<ReturnType<typeof verifyTrustedForm>> | { status: 'unconfigured' | 'skipped'; cert_id?: string } = certUrl
    ? wantLiveHlr && tfKey
      ? await verifyTrustedForm(certUrl, { phone: n })
      : { status: tfKey ? 'skipped' : 'unconfigured', cert_id: certId }
    : { status: 'skipped' };

  const mode = input.mode === 'fail_open' ? 'fail_open' : 'fail_closed';
  let internalDnc: { evaluated: boolean; listed: boolean; entry_requested_at?: string } = { evaluated: false, listed: false };
  let internalDncError = false;
  if (input.ownerKey && /^\+\d{7,15}$/.test(n)) {
    try {
      internalDnc = await isSuppressed(input.ownerKey, n);
    } catch {
      internalDncError = true;
    }
  }
  const readiness = evaluateShieldReadiness();
  if (readiness.block_reason && mode === 'fail_closed') {
    const data_sources = buildDataSourceReceipts();
    return {
      decision: 'block' as const,
      reason: readiness.block_reason,
      checks: {
        valid_number: /^\+\d{7,15}$/.test(n),
        internal_dnc: internalDnc,
        line_type: 'unknown' as const,
        disconnected: false,
        litigator: { hit: false },
        dnc: { listed: false, source: 'registry_not_loaded' },
        reassigned: { reassigned: false, status: 'unavailable' },
        consent: {
          declared: !!input.consent?.declared,
          type: consentType,
          sufficient_for_ai: consentType === 'express_written',
        },
        calling_hours: { applicable: false },
      },
      mode,
      degraded: true,
      profile,
      upstream_live: false,
      data_sources,
      verified_at: now.toISOString(),
      fresh_for_hours: 1,
      evidence_id: '',
      risk_score: 95,
    };
  }
  const up = await upstreamPhone(n, {
    allow_network: wantLiveHlr,
    timeout_ms: wantLiveHlr ? 75 : 0,
  });
  const upstream_live = up.source === 'telnyx' || up.source === 'telnyx_cache';
  const lineType: GateChecks['line_type'] = ((upstream_live || allowDevMocks()) && ['mobile', 'landline', 'voip'].includes(String(up.lineType)) ? up.lineType : allowDevMocks() ? lineTypeFor(n) : 'unknown') as GateChecks['line_type'];
  const disconnected = ((upstream_live || allowDevMocks()) && (up as any).disconnected === true) || (allowDevMocks() && !wantLiveHlr && disconnectedFor(n));
  const litigator = mockLitigator(n);
  const dnc = mockDNC(n);
  const reassigned = await reassignedFor(n, wantLiveHlr);
  const hours = callingHoursFor(n, now);

  const checks: GateChecks = {
    valid_number: /^\+\d{7,15}$/.test(n),
    internal_dnc: internalDnc,
    line_type: lineType,
    disconnected,
    litigator,
    dnc,
    reassigned,
    consent: {
      declared: !!input.consent?.declared,
      type: consentType,
      // FCC-24-17: AI voice = artificial voice -> prior express WRITTEN consent for wireless/voip
      sufficient_for_ai: consentType === 'express_written',
      trustedform: certUrl
        ? {
            status: trustedform.status,
            cert_id: (trustedform as { cert_id?: string }).cert_id || certId,
            captured_at: (trustedform as { captured_at?: string }).captured_at,
          }
        : undefined,
    },
    calling_hours: hours as GateChecks['calling_hours'],
  };

  // Failure mode: fail_closed (default) = if the gate itself fails/times out, BLOCK (safe).
  // fail_open = if the gate cannot answer, ALLOW with degraded flag so campaigns keep running.
  // NEVER overrides legal blocks (DNC/litigator/consent) — only covers gate-availability failures.
  // 'review' = inconclusive, agent should pause / route a human — never silently allow.
  let decision: 'allow' | 'review' | 'block' = 'allow';
  let reason = 'cleared';
  let risk = 0;
  let degraded = up.source === 'mock_fallback' || lineType === 'unknown';

  // ── Waiver (approval path only) ─────────────────────────────────────────────
  // When gate-service passes `waive`, the ladder skips ONLY that one condition.
  // The waive reason must be in WAIVABLE_REASONS; anything else is silently
  // ignored so clients cannot inject a waiver via the request body.
  const waiveReason = input.waive && WAIVABLE_REASONS.has(input.waive.reason) ? input.waive.reason : null;

  // Helper: returns true if this condition should be treated as passed.
  function isWaived(conditionReason: string): boolean {
    return waiveReason === conditionReason;
  }

  // certPending: a TrustedForm cert was supplied but cannot be verified right now.
  // Pre-computed here (before the ladder) so the outer condition can exclude the waived case,
  // allowing the ladder to fall through to quiet-hours / timezone checks when waived.
  const tfStatus = checks.consent.trustedform?.status;
  const certPending = checks.consent.declared && !!certUrl &&
    (tfStatus === 'unconfigured' || tfStatus === 'error');

  if (!checks.valid_number) { decision = 'block'; reason = 'invalid_number'; risk = 90; }
  else if (internalDncError && !isWaived('internal_dnc_unavailable')) { decision = 'review'; reason = 'internal_dnc_unavailable'; risk = 60; }
  else if (internalDnc.listed) { decision = 'block'; reason = 'internal_dnc'; risk = 100; }
  else if (disconnected && !isWaived('disconnected')) { decision = 'block'; reason = 'disconnected'; risk = 85; }
  // Litigator trap before DNC — professional TCPA plaintiffs are the highest agency risk.
  else if (litigator.hit && !isWaived('litigator_list')) { decision = 'block'; reason = 'litigator_list'; risk = 100; }
  else if (reassigned.reassigned && !checks.consent.declared) { decision = 'block'; reason = 'reassigned_number_consent_required'; risk = 80; }
  else if (dnc.listed && !checks.consent.declared) { decision = 'block'; reason = 'do_not_call_no_consent'; risk = 75; }
  else if (wantLiveHlr && !allowDevMocks() && lineType === 'unknown') { decision = 'block'; reason = 'gate_unavailable_fail_closed'; risk = 95; }
  // Consistency proof supplied but contradicted by the source — the claimed consent does not exist.
  else if (certUrl && trustedform.status === 'invalid') { decision = 'block'; reason = 'consent_cert_invalid'; risk = 85; }
  // full_stack asked the reassigned-number check and the source could not answer:
  // consents can go stale (number reassigned since consent) — human decides, no silent allow.
  else if (wantLiveHlr && reassigned.status === 'unavailable' && !isWaived('reassigned_check_unavailable')) { decision = 'review'; reason = 'reassigned_check_unavailable'; risk = 55; }
  // FCC Feb 2024 AI rule: AI voice = artificial voice -> prior express WRITTEN consent.
  // The outer condition excludes the waived-cert case so the ladder continues evaluating
  // quiet-hours and timezone_unknown when consent_cert_unverified has been approved.
  else if (
    (lineType === 'mobile' || lineType === 'voip' || lineType === 'unknown') &&
    !checks.consent.sufficient_for_ai &&
    !(certPending && isWaived('consent_cert_unverified'))
  ) {
    if (certPending) {
      // A TrustedForm certificate was supplied but could not be verified right now —
      // escalate to a human instead of siding with either the claimant or the block.
      decision = 'review'; reason = 'consent_cert_unverified'; risk = 60;
    } else {
      decision = 'block'; reason = 'ai_voice_consent_required'; risk = 70;
    }
  }
  else if (hours.applicable && hours.allowed === false) { decision = 'block'; reason = hours.window_source === 'federal' ? 'quiet_hours' : 'state_quiet_hours'; risk = 40; }
  else if (hours.applicable && hours.allowed === null && !isWaived('timezone_unknown')) { decision = 'review'; reason = 'timezone_unknown'; risk = 45; }
  else if (dnc.listed) { reason = 'dnc_but_consent_on_file'; risk = 20; }
  else if (lineType === 'landline') { reason = 'cleared_landline'; risk = 5; }

  // Record waiver in checks for audit trail (only if a waiver was actually used in the path)
  if (waiveReason && input.waive) {
    checks.waived = { reason: waiveReason, approval_id: input.waive.approval_id };
  }

  const data_sources = buildDataSourceReceipts({ upstream_live, telnyx_configured: !!process.env.TELNYX_API_KEY });
  if (certUrl) {
    data_sources.push({
      id: 'trustedform_consent',
      vendor: 'TrustedForm (ActiveProspect)',
      status:
        trustedform.status === 'verified' ? 'live'
        : trustedform.status === 'invalid' ? 'failed'
        : 'missing',
      refreshed_at: now.toISOString(),
    });
  }
  return {
    decision, reason, checks,
    mode,
    degraded,
    profile,
    upstream_live,
    data_sources,
    verified_at: now.toISOString(),
    fresh_for_hours: 24,
    evidence_id: '', // sealed by caller (route) after this returns
    risk_score: risk,
  };
}

export type InboundGateChecks = {
  valid_number: boolean;
  customer_block_list: { evaluated: boolean; blocked: boolean };
  litigator: { hit: boolean; list: string | null };
  outbound_rules: {
    dnc: 'not_evaluated';
    consent: 'not_evaluated';
    calling_hours: 'not_evaluated';
    reassigned: 'not_evaluated';
    line_type: 'not_evaluated';
  };
};

export type InboundGateResult = {
  decision: 'allow' | 'block';
  reason: 'invalid_number' | 'inbound_allowed' | 'blocked_by_customer';
  checks: InboundGateChecks;
  verified_at: string;
  fresh_for_hours: number;
  evidence_id: string;
  risk_score: number;
};

/**
 * Inbound calls use a separate policy: validate the caller, check the
 * customer's internal suppression list when authenticated, and expose a
 * litigator match, without applying outbound DNC/consent/hours rules.
 */
export async function runInboundScreen(phone: string, account: Account | null): Promise<InboundGateResult> {
  const normalized = normalizePhone(phone);
  const valid = /^\+\d{7,15}$/.test(normalized);
  const ownerKey = account ? ownerKeyFor(account) : null;
  let customerBlock = { evaluated: false, blocked: false };
  if (valid && ownerKey) {
    try {
      const sup = await isSuppressed(ownerKey, normalized);
      customerBlock = { evaluated: sup.evaluated, blocked: sup.listed };
    } catch {
      customerBlock = { evaluated: false, blocked: true };
    }
  }
  const litigator = valid ? mockLitigator(normalized) : { hit: false, list: undefined };
  const checks: InboundGateChecks = {
    valid_number: valid,
    customer_block_list: customerBlock,
    litigator: { hit: litigator.hit, list: litigator.list ?? null },
    outbound_rules: {
      dnc: 'not_evaluated',
      consent: 'not_evaluated',
      calling_hours: 'not_evaluated',
      reassigned: 'not_evaluated',
      line_type: 'not_evaluated',
    },
  };
  const decision = !valid || customerBlock.blocked ? 'block' : 'allow';
  const reason = !valid ? 'invalid_number' : customerBlock.blocked ? 'blocked_by_customer' : 'inbound_allowed';
  return {
    decision,
    reason,
    checks,
    verified_at: new Date().toISOString(),
    fresh_for_hours: 24,
    evidence_id: '',
    risk_score: !valid ? 90 : customerBlock.blocked ? 100 : litigator.hit ? 25 : 0,
  };
}

// ---- Pre-send email gate (for AI SDRs): same contract, email flavor ----
export async function runEmailGate(email: string) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  const local = (email.split('@')[0] || '').toLowerCase();
  const syntaxOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const disposable = ['mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com'].includes(domain);
  const role = /^(info|admin|sales|support|contact|billing|noreply|no-reply|hello)@/.test(local + '@');
  const catchAll = domain ? hash(domain) % 9 === 0 : false;
  const freeProvider = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'].includes(domain);

  let decision: 'send' | 'hold' | 'block' = 'send';
  let reason = 'cleared';
  let risk = 5;
  if (!syntaxOk) { decision = 'block'; reason = 'invalid_syntax'; risk = 95; }
  else if (disposable) { decision = 'block'; reason = 'disposable_domain'; risk = 90; }
  else if (catchAll) { decision = 'hold'; reason = 'catch_all_domain_unverified'; risk = 55; }
  else if (role) { decision = 'hold'; reason = 'role_account'; risk = 35; }
  else if (!domain) { decision = 'block'; reason = 'invalid_syntax'; risk = 95; }

  return {
    decision, reason,
    checks: {
      valid_syntax: syntaxOk, domain, disposable, role_account: role,
      catch_all: catchAll, free_provider: freeProvider,
      mx: domain ? hash(domain + '|mx') % 50 !== 0 : false,
    },
    verified_at: new Date().toISOString(),
    fresh_for_hours: 168, // emails decay slower; re-verify weekly
    evidence_id: '',
    risk_score: risk,
  };
}
