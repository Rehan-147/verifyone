// Canonical map: gate check -> vendor -> ingest (API receipts + docs).
export type DataSourceDef = {
  id: string;
  check: string;
  vendor: string;
  ingest: 'local_file' | 'live_api' | 'derived' | 'customer';
  refresh_sla: string;
  env?: string;
  file?: string;
};

export const DATA_SOURCE_CATALOG: DataSourceDef[] = [
  { id: 'ftc_dnc', check: 'federal_dnc', vendor: 'FTC National Do Not Call Registry', ingest: 'local_file', refresh_sla: '31 days (64.1200(c)(2))', file: '.data/dnc-us.txt' },
  { id: 'crtc_dncl', check: 'federal_dnc', vendor: 'CRTC Canada National Do Not Call List', ingest: 'local_file', refresh_sla: 'monthly download', file: '.data/dnc-ca.txt' },
  { id: 'litigator_trap', check: 'litigator_scrub', vendor: 'TCPA litigator list (vendor export)', ingest: 'local_file', refresh_sla: '7 days recommended', file: '.data/litigators.txt' },
  { id: 'quiet_hours', check: 'calling_hours', vendor: 'VerifyOne NPA to IANA timezone map', ingest: 'derived', refresh_sla: 'static' },
  { id: 'e164', check: 'valid_number', vendor: 'E.164 normalization', ingest: 'derived', refresh_sla: 'static' },
  { id: 'telnyx_hlr', check: 'line_type_disconnected', vendor: 'Telnyx Number Lookup', ingest: 'live_api', refresh_sla: '24h cache', env: 'TELNYX_API_KEY' },
  { id: 'fcc_rndb', check: 'reassigned_number', vendor: 'FCC Reassigned Numbers Database', ingest: 'live_api', refresh_sla: 'full_stack profile', env: 'RNDB_API_URL + RNDB_API_KEY, or TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN' },
  { id: 'trustedform_consent', check: 'ai_voice_consent', vendor: 'TrustedForm (ActiveProspect) certificate', ingest: 'live_api', refresh_sla: 'per call (full_stack)', env: 'TRUSTEDFORM_API_KEY' },
  { id: 'consent_declared', check: 'ai_voice_consent', vendor: 'Customer consent record', ingest: 'customer', refresh_sla: 'per call' },
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
