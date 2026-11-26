// Canonical map: gate check -> vendor -> ingest (API receipts + docs).
export type DataSourceDef = {
  id: string;
  check: string;
  vendor: string;
  ingest: 'local_file' | 'live_api' | 'derived' | 'customer';
  refresh_sla: string;
  what_it_does: string;
  coverage: string;
  failure_behavior: string;
  limitation?: string;
  env?: string;
  file?: string;
};

export const DATA_SOURCE_CATALOG: DataSourceDef[] = [
  {
    id: 'internal_dnc',
    check: 'internal_dnc',
    vendor: 'Customer internal suppression list',
    ingest: 'customer',
    refresh_sla: 'real-time (immediate on opt-out)',
    what_it_does: 'Checks the caller\'s own organization/account internal Do-Not-Call list before any other compliance check, overriding prior consent.',
    coverage: 'All authenticated organization and account callers (anonymous free-tier callers have no list).',
    failure_behavior: 'DB/store read error for an authenticated caller → REVIEW (INTERNAL_DNC_UNAVAILABLE); listed → DENY (INTERNAL_DNC). Never a silent ALLOW.',
    limitation: 'Customer-maintained via outcome opt-outs, API, lead-intake, and dashboard.',
  },
  {
    id: 'ftc_dnc',
    check: 'federal_dnc',
    vendor: 'FTC National Do Not Call Registry',
    ingest: 'local_file',
    refresh_sla: '31 days (64.1200(c)(2))',
    what_it_does: 'Screens US +1 numbers against the loaded Federal Do Not Call registry before dialing when no consent is declared.',
    coverage: 'US NANP (+1) numbers for area codes downloaded under your FTC Subscription Account Number (SAN).',
    failure_behavior: 'Unavailable in production under default fail_closed mode → DENY (REGISTRY_UNAVAILABLE), never a silent ALLOW.',
    limitation: 'Official FTC access is area-code downloads under the customer\'s own SAN; there is no real-time FTC API.',
    file: '.data/dnc-us.txt',
  },
  {
    id: 'crtc_dncl',
    check: 'federal_dnc',
    vendor: 'CRTC Canada National Do Not Call List',
    ingest: 'local_file',
    refresh_sla: 'monthly download',
    what_it_does: 'Screens Canadian +1 numbers against the loaded CRTC National Do Not Call List.',
    coverage: 'Canadian NANP (+1) area codes downloaded via CRTC DNCL registrant access.',
    failure_behavior: 'Checked alongside FTC DNC when loaded; if FTC DNC is also missing in production under fail_closed → DENY (REGISTRY_UNAVAILABLE).',
    limitation: 'Requires CRTC DNCL registrant access and periodic file refresh.',
    file: '.data/dnc-ca.txt',
  },
  {
    id: 'litigator_trap',
    check: 'litigator_scrub',
    vendor: 'TCPA litigator list (vendor export)',
    ingest: 'local_file',
    refresh_sla: '7 days recommended',
    what_it_does: 'Screens destination numbers against known TCPA serial litigator and plaintiff attorney lists before DNC checks.',
    coverage: 'Depends on the licensed feed in use; coverage and refresh per contract.',
    failure_behavior: 'Unavailable in production under default fail_closed mode → DENY (REGISTRY_UNAVAILABLE), never a silent ALLOW.',
    limitation: 'Depends on the licensed feed in use; coverage and refresh per contract.',
    file: '.data/litigators.txt',
  },
  {
    id: 'quiet_hours',
    check: 'calling_hours',
    vendor: 'VerifyOne NPA to IANA timezone map',
    ingest: 'derived',
    refresh_sla: 'static',
    what_it_does: 'Computes recipient local time from NANP area code and blocks calls outside permitted calling windows.',
    coverage: 'US and Canada (+1) area codes; federal 08:00–21:00 plus listed stricter state windows (FL, OK, WA — 08:00–20:00).',
    failure_behavior: 'Unknown area code / timezone → REVIEW (timezone_unknown); outside window → DENY (QUIET_HOURS / state_quiet_hours). Never a silent ALLOW.',
    limitation: 'State rules pending counsel review; Sunday/holiday restrictions are not implemented.',
  },
  {
    id: 'e164',
    check: 'valid_number',
    vendor: 'E.164 normalization',
    ingest: 'derived',
    refresh_sla: 'static',
    what_it_does: 'Validates international E.164 phone syntax and digit length before any registry lookup.',
    coverage: 'Global E.164 numbering format (+[1-9], 7–15 digits).',
    failure_behavior: 'Invalid format → DENY (INVALID_NUMBER), never a silent ALLOW.',
  },
  {
    id: 'telnyx_hlr',
    check: 'line_type_disconnected',
    vendor: 'Telnyx Number Lookup',
    ingest: 'live_api',
    refresh_sla: '24h cache',
    what_it_does: 'Queries live carrier line type (mobile, landline, VoIP) and disconnected status on the full_stack profile.',
    coverage: 'Global carrier routing where supported by Telnyx Number Lookup.',
    failure_behavior: 'On full_stack in production, unknown/unavailable line type → DENY (GATE_UNAVAILABLE); disconnected → DENY (DISCONNECTED). Never a silent ALLOW.',
    limitation: 'Live lookup runs on full_stack profile and requires TELNYX_API_KEY.',
    env: 'TELNYX_API_KEY',
  },
  {
    id: 'fcc_rndb',
    check: 'reassigned_number',
    vendor: 'FCC Reassigned Numbers Database',
    ingest: 'live_api',
    refresh_sla: 'full_stack profile',
    what_it_does: 'Checks whether a number has been permanently disconnected and reassigned since consent may have been captured.',
    coverage: 'US numbers via configured RNDB provider or Twilio Lookup v2 reassigned_number.',
    failure_behavior: 'On full_stack when unavailable/inconclusive → REVIEW (reassigned_check_unavailable); reassigned without consent → DENY (REASSIGNED_NUMBER). Never a silent ALLOW.',
    limitation: 'Runs on full_stack profile; requires RNDB_API_URL + RNDB_API_KEY or Twilio credentials.',
    env: 'RNDB_API_URL + RNDB_API_KEY, or TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN',
  },
  {
    id: 'trustedform_consent',
    check: 'ai_voice_consent',
    vendor: 'TrustedForm (ActiveProspect) certificate',
    ingest: 'live_api',
    refresh_sla: 'per call (full_stack)',
    what_it_does: 'Verifies a customer-supplied TrustedForm certificate URL against the destination phone number on full_stack.',
    coverage: 'Web-form leads with an ActiveProspect TrustedForm certificate URL.',
    failure_behavior: 'Invalid cert → DENY (consent_cert_invalid); unconfigured or error with declared consent → REVIEW (consent_cert_unverified). Never a silent ALLOW.',
    limitation: 'VerifyOne verifies and records consent claims; it does not create consent.',
    env: 'TRUSTEDFORM_API_KEY',
  },
  {
    id: 'consent_declared',
    check: 'ai_voice_consent',
    vendor: 'Customer consent record',
    ingest: 'customer',
    refresh_sla: 'per call',
    what_it_does: 'Evaluates caller-supplied consent status (express_written, ebr, none) against AI-voice consent rules.',
    coverage: 'Every gate request (per-call payload or lead-intake record).',
    failure_behavior: 'Missing express_written consent on mobile/VoIP/unknown lines → DENY (TCPA_AI_VOICE_CONSENT), never a silent ALLOW.',
    limitation: 'VerifyOne verifies and records consent claims; it does not create consent.',
  },
];

export type DataSourceReceipt = {
  id: string;
  vendor: string;
  status: 'loaded' | 'missing' | 'live' | 'derived' | 'customer' | 'failed';
  refreshed_at?: string;
  records?: number;
  /** Self-serve launch hint shown when a checkable source is not contributing. */
  fix_hint?: string;
};
