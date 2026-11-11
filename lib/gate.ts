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

export type GateChecks = {
  valid_number: boolean;
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
  calling_hours: { applicable: boolean; timezone?: string; local_time?: string; window?: string; allowed?: boolean; tz_assumed?: boolean };
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

// --- Representative NPA (area code) -> IANA timezone map, US + CA ---
const NPA_TZ: Record<string, string> = {
  '201':'America/New_York','212':'America/New_York','215':'America/New_York','216':'America/New_York',
  '224':'America/Chicago','229':'America/New_York','231':'America/Detroit','234':'America/New_York',
  '239':'America/New_York','240':'America/New_York','248':'America/Detroit','251':'America/Chicago',
  '253':'America/Los_Angeles','254':'America/Chicago','256':'America/Chicago','260':'America/Indiana/Indianapolis',
  '262':'America/Chicago','267':'America/New_York','269':'America/Detroit','270':'America/Chicago',
  '276':'America/New_York','281':'America/Chicago','301':'America/New_York','302':'America/New_York',
  '303':'America/Denver','304':'America/New_York','305':'America/New_York','307':'America/Denver',
  '308':'America/Chicago','309':'America/Chicago','312':'America/Chicago','313':'America/Detroit',
  '314':'America/Chicago','315':'America/New_York','316':'America/Chicago','317':'America/Indiana/Indianapolis',
  '318':'America/Chicago','319':'America/Chicago','320':'America/Chicago','321':'America/New_York',
  '323':'America/Los_Angeles','325':'America/Chicago','330':'America/New_York','331':'America/Chicago',
  '334':'America/Chicago','336':'America/New_York','337':'America/Chicago','339':'America/New_York',
  '346':'America/Chicago','347':'America/New_York','351':'America/New_York','352':'America/New_York',
  '360':'America/Los_Angeles','361':'America/Chicago','364':'America/Chicago','380':'America/New_York',
  '385':'America/Denver','386':'America/New_York','401':'America/New_York','402':'America/Chicago',
  '404':'America/New_York','405':'America/Chicago','406':'America/Denver','407':'America/New_York',
  '408':'America/Los_Angeles','409':'America/Chicago','410':'America/New_York','412':'America/New_York',
  '413':'America/New_York','414':'America/Chicago','415':'America/Los_Angeles','417':'America/Chicago',
  '419':'America/New_York','423':'America/New_York','424':'America/Los_Angeles','425':'America/Los_Angeles',
  '430':'America/Chicago','432':'America/Chicago','434':'America/New_York','435':'America/Denver',
  '440':'America/New_York','442':'America/Los_Angeles','443':'America/New_York','445':'America/New_York',
  '450':'America/Toronto','458':'America/Los_Angeles','463':'America/Indiana/Indianapolis','469':'America/Chicago',
  '470':'America/New_York','475':'America/New_York','478':'America/New_York','479':'America/Chicago',
  '480':'America/Phoenix','484':'America/New_York','501':'America/Chicago','502':'America/New_York',
  '503':'America/Los_Angeles','504':'America/Chicago','505':'America/Denver','507':'America/Chicago',
  '508':'America/New_York','509':'America/Los_Angeles','510':'America/Los_Angeles','512':'America/Chicago',
  '513':'America/New_York','516':'America/New_York','517':'America/Detroit','518':'America/New_York',
  '520':'America/Phoenix','530':'America/Los_Angeles','531':'America/Chicago','539':'America/Chicago',
  '540':'America/New_York','541':'America/Los_Angeles','551':'America/New_York','559':'America/Los_Angeles',
  '561':'America/New_York','562':'America/Los_Angeles','563':'America/Chicago','564':'America/Los_Angeles',
  '567':'America/New_York','570':'America/New_York','571':'America/New_York','573':'America/Chicago',
  '574':'America/Indiana/Indianapolis','575':'America/Denver','580':'America/Chicago','585':'America/New_York',
  '586':'America/Detroit','587':'America/Edmonton','601':'America/Chicago','602':'America/Phoenix',
  '603':'America/New_York','605':'America/Chicago','606':'America/New_York','607':'America/New_York',
  '608':'America/Chicago','609':'America/New_York','610':'America/New_York','612':'America/Chicago',
  '614':'America/New_York','615':'America/Chicago','616':'America/Detroit','617':'America/New_York',
  '618':'America/Chicago','619':'America/Los_Angeles','620':'America/Chicago','623':'America/Phoenix',
  '626':'America/Los_Angeles','629':'America/Chicago','630':'America/Chicago','631':'America/New_York',
  '636':'America/Chicago','641':'America/Chicago','646':'America/New_York','647':'America/Toronto',
  '650':'America/Los_Angeles','651':'America/Chicago','657':'America/Los_Angeles','659':'America/Chicago',
  '660':'America/Chicago','661':'America/Los_Angeles','662':'America/Chicago','667':'America/New_York',
  '678':'America/New_York','681':'America/New_York','682':'America/Chicago','689':'America/New_York',
  '701':'America/Chicago','702':'America/Los_Angeles','703':'America/New_York','704':'America/New_York',
  '706':'America/New_York','707':'America/Los_Angeles','708':'America/Chicago','712':'America/Chicago',
  '713':'America/Chicago','714':'America/Los_Angeles','715':'America/Chicago','716':'America/New_York',
  '717':'America/New_York','718':'America/New_York','719':'America/Denver','720':'America/Denver',
  '724':'America/New_York','725':'America/Los_Angeles','726':'America/Chicago','727':'America/New_York',
  '731':'America/Chicago','732':'America/New_York','734':'America/Detroit','737':'America/Chicago',
  '740':'America/New_York','742':'America/Toronto','747':'America/Los_Angeles','754':'America/New_York',
  '757':'America/New_York','760':'America/Los_Angeles','762':'America/New_York','763':'America/Chicago',
  '765':'America/Indiana/Indianapolis','769':'America/Chicago','770':'America/New_York','772':'America/New_York',
  '773':'America/Chicago','774':'America/New_York','775':'America/Los_Angeles','778':'America/Vancouver',
  '779':'America/Chicago','781':'America/New_York','782':'America/Halifax','785':'America/Chicago',
  '786':'America/New_York','801':'America/Denver','802':'America/New_York','803':'America/New_York',
  '804':'America/New_York','805':'America/Los_Angeles','806':'America/Chicago','808':'Pacific/Honolulu',
  '810':'America/Detroit','812':'America/Indiana/Indianapolis','813':'America/New_York','814':'America/New_York',
  '815':'America/Chicago','816':'America/Chicago','817':'America/Chicago','818':'America/Los_Angeles',
  '819':'America/Toronto','828':'America/New_York','830':'America/Chicago','831':'America/Los_Angeles',
  '832':'America/Chicago','843':'America/New_York','845':'America/New_York','847':'America/Chicago',
  '848':'America/New_York','850':'America/New_York','854':'America/New_York','856':'America/New_York',
  '857':'America/New_York','858':'America/Los_Angeles','859':'America/New_York','860':'America/New_York',
  '862':'America/New_York','863':'America/New_York','864':'America/New_York','865':'America/New_York',
  '870':'America/Chicago','872':'America/Chicago','873':'America/Toronto','878':'America/New_York',
  '901':'America/Chicago','903':'America/Chicago','904':'America/New_York','906':'America/Detroit',
  '907':'America/Anchorage','908':'America/New_York','909':'America/Los_Angeles','910':'America/New_York',
  '912':'America/New_York','913':'America/Chicago','914':'America/New_York','915':'America/Chicago',
  '916':'America/Los_Angeles','917':'America/New_York','918':'America/Chicago','919':'America/New_York',
  '920':'America/Chicago','925':'America/Los_Angeles','928':'America/Phoenix','929':'America/New_York',
  '930':'America/Indiana/Indianapolis','931':'America/Chicago','936':'America/Chicago','937':'America/New_York',
  '938':'America/Chicago','940':'America/Chicago','941':'America/New_York','945':'America/Chicago',
  '947':'America/Detroit','949':'America/Los_Angeles','951':'America/Los_Angeles','952':'America/Chicago',
  '954':'America/New_York','956':'America/Chicago','959':'America/New_York','970':'America/Denver',
  '971':'America/Los_Angeles','972':'America/Chicago','973':'America/New_York','975':'America/Chicago',
  '978':'America/New_York','979':'America/Chicago','980':'America/New_York','984':'America/New_York',
  '985':'America/Chicago','986':'America/Boise','989':'America/Detroit',
  '917x':'','204':'America/Winnipeg','236':'America/Vancouver','250':'America/Vancouver',
  '263':'America/Toronto','289':'America/Toronto','306':'America/Regina','343':'America/Toronto',
  '365':'America/Toronto','403':'America/Edmonton','416':'America/Toronto','431':'America/Winnipeg',
  '437':'America/Toronto','438':'America/Toronto','514':'America/Toronto','519':'America/Toronto',
  '581':'America/Toronto','584':'America/Toronto','604':'America/Vancouver','613':'America/Toronto',
  '639':'America/Regina','672':'America/Vancouver','705':'America/Toronto',
  '709':'America/St_Johns','780':'America/Edmonton','807':'America/Toronto','825':'America/Edmonton',
  '867':'America/Edmonton','902':'America/Halifax','905':'America/Toronto',
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
  const tz = NPA_TZ[n.slice(2, 5)];
  const tzIANA = tz || 'America/New_York';
  const tzAssumed = !tz;
  const t = now || new Date();
  const local = new Intl.DateTimeFormat('en-US', { timeZone: tzIANA, hour12: false, hour: '2-digit', minute: '2-digit' }).format(t);
  const hour = parseInt(local.slice(0, 2), 10);
  const allowed = hour >= 8 && hour < 21; // 47 CFR 64.1200(c)(1): 8am-9pm local
  return { applicable: true as const, timezone: tzIANA, local_time: local, window: '08:00-21:00', allowed, tz_assumed: tzAssumed };
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
  const readiness = evaluateShieldReadiness();
  if (readiness.block_reason && mode === 'fail_closed') {
    const data_sources = buildDataSourceReceipts();
    return {
      decision: 'block' as const,
      reason: readiness.block_reason,
      checks: {
        valid_number: /^\+\d{7,15}$/.test(n),
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

  if (!checks.valid_number) { decision = 'block'; reason = 'invalid_number'; risk = 90; }
  else if (disconnected) { decision = 'block'; reason = 'disconnected'; risk = 85; }
  // Litigator trap before DNC — professional TCPA plaintiffs are the highest agency risk.
  else if (litigator.hit) { decision = 'block'; reason = 'litigator_list'; risk = 100; }
  else if (reassigned.reassigned && !checks.consent.declared) { decision = 'block'; reason = 'reassigned_number_consent_required'; risk = 80; }
  else if (dnc.listed && !checks.consent.declared) { decision = 'block'; reason = 'do_not_call_no_consent'; risk = 75; }
  else if (wantLiveHlr && !allowDevMocks() && lineType === 'unknown') { decision = 'block'; reason = 'gate_unavailable_fail_closed'; risk = 95; }
  // Consistency proof supplied but contradicted by the source — the claimed consent does not exist.
  else if (certUrl && trustedform.status === 'invalid') { decision = 'block'; reason = 'consent_cert_invalid'; risk = 85; }
  // full_stack asked the reassigned-number check and the source could not answer:
  // consents can go stale (number reassigned since consent) — human decides, no silent allow.
  else if (wantLiveHlr && reassigned.status === 'unavailable') { decision = 'review'; reason = 'reassigned_check_unavailable'; risk = 55; }
  else if ((lineType === 'mobile' || lineType === 'voip' || lineType === 'unknown') && !checks.consent.sufficient_for_ai) {
    const tfStatus = checks.consent.trustedform?.status;
    if (checks.consent.declared && certUrl && (tfStatus === 'unconfigured' || tfStatus === 'error')) {
      // A TrustedForm certificate was supplied but could not be verified right now —
      // escalate to a human instead of siding with either the claimant or the block.
      decision = 'review'; reason = 'consent_cert_unverified'; risk = 60;
    } else {
      // FCC Feb 2024 AI rule: AI voice = artificial voice -> prior express WRITTEN consent
      decision = 'block'; reason = 'ai_voice_consent_required'; risk = 70;
    }
  }
  else if (hours.applicable && hours.allowed === false) { decision = 'block'; reason = 'quiet_hours'; risk = 40; }
  else if (dnc.listed) { reason = 'dnc_but_consent_on_file'; risk = 20; }
  else if (lineType === 'landline') { reason = 'cleared_landline'; risk = 5; }

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
