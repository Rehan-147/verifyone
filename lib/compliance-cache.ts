// Zero-hop compliance lookups: federal DNC file + litigator trap list (local Sets).
import fs from 'fs';
import path from 'path';
import { dncCheck as upstreamDncCheck } from './upstream';
import { reassignedConfigured } from './rndb';
import type { DataSourceReceipt } from './data-sources';

const DATA = path.join(process.cwd(), '.data');
const DNC_FILE = path.join(DATA, 'dnc-us.txt');
const DNC_CA_FILE = path.join(DATA, 'dnc-ca.txt'); // CRTC Canada National DNCL
const LITIGATOR_FILE = path.join(DATA, 'litigators.txt');
const META_FILE = path.join(DATA, 'registry-meta.json');

export type RegistryHealth = {
  dnc: { ready: boolean; records: number; refreshed_at: string | null; file: string };
  dnc_ca: { ready: boolean; records: number; refreshed_at: string | null; file: string };
  litigator: { ready: boolean; records: number; refreshed_at: string | null; file: string };
};

type RegistryState = {
  dnc: Set<string> | null;
  dncCa: Set<string> | null;
  litigators: Set<string> | null;
  dncMtime: number;
  dncCaMtime: number;
  litMtime: number;
  loadedAt: number;
};

const state: RegistryState = {
  dnc: null,
  dncCa: null,
  litigators: null,
  dncMtime: 0,
  dncCaMtime: 0,
  litMtime: 0,
  loadedAt: 0,
};

function normalize10(phone: string) {
  return phone.replace(/[^0-9]/g, '').slice(-10);
}

/**
 * Extract one 10-digit NANP number from a registry/scrub line.
 * Handles plain "14155550123", "+14155550123", "(415) 555-0123",
 * CSV rows where the FIRST phone-shaped column wins (headers/count columns
 * must not corrupt the number), and whitespace-separated dumps.
 */
export function parsePhoneToken(line: string): string | null {
  if (!line) return null;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const phoneShaped = trimmed.match(
    /(?:\+?1[\s.)-]*)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  );
  if (phoneShaped) return normalize10(phoneShaped[0]);
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (/^1?\d{10}$/.test(digits)) return digits.slice(-10);
  return null;
}

function loadLines(file: string): Set<string> {
  if (!fs.existsSync(file)) return new Set();
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const set = new Set<string>();
  for (const line of lines) {
    const n = parsePhoneToken(line);
    if (n) set.add(n);
  }
  return set;
}

function isoMtime(file: string): string | null {
  try {
    if (!fs.existsSync(file)) return null;
    return new Date(fs.statSync(file).mtimeMs).toISOString();
  } catch {
    return null;
  }
}

export function maybeReload() {
  try {
    const dncStat = fs.existsSync(DNC_FILE) ? fs.statSync(DNC_FILE).mtimeMs : 0;
    const dncCaStat = fs.existsSync(DNC_CA_FILE) ? fs.statSync(DNC_CA_FILE).mtimeMs : 0;
    const litStat = fs.existsSync(LITIGATOR_FILE) ? fs.statSync(LITIGATOR_FILE).mtimeMs : 0;
    if (
      state.dnc && state.dncMtime === dncStat &&
      state.dncCa && state.dncCaMtime === dncCaStat &&
      state.litigators && state.litMtime === litStat &&
      Date.now() - state.loadedAt < 60_000
    ) {
      return;
    }
    state.dnc = loadLines(DNC_FILE);
    state.dncCa = loadLines(DNC_CA_FILE);
    state.litigators = loadLines(LITIGATOR_FILE);
    state.dncMtime = dncStat;
    state.dncCaMtime = dncCaStat;
    state.litMtime = litStat;
    state.loadedAt = Date.now();
  } catch {
    if (!state.dnc) state.dnc = new Set();
    if (!state.dncCa) state.dncCa = new Set();
    if (!state.litigators) state.litigators = new Set();
  }
}

export function litigatorCheck(phone: string): { hit: boolean; list?: string; source: string } {
  maybeReload();
  const n = normalize10(phone);
  if (state.litigators && state.litigators.size > 0 && n.length === 10) {
    if (state.litigators.has(n)) {
      return { hit: true, list: 'local_litigator_registry', source: 'litigator_file' };
    }
    return { hit: false, source: 'litigator_file' };
  }
  return { hit: false, source: 'litigator_file_not_loaded' };
}

export function dncLocalCheck(phone: string): { listed: boolean; source: string } {
  maybeReload();
  const n = normalize10(phone);
  const usReady = !!state.dnc && state.dnc.size > 0;
  const caReady = !!state.dncCa && state.dncCa.size > 0;
  if ((usReady || caReady) && n.length === 10) {
    // Both the FTC (US) and CRTC (Canada) lists share the NANP +1 numbering plan,
    // so one normalized 10-digit check covers both — the source receipt tells
    // the caller which registry produced the answer.
    if (usReady && state.dnc!.has(n)) return { listed: true, source: 'ftc_registry_cache' };
    if (caReady && state.dncCa!.has(n)) return { listed: true, source: 'crtc_dncl_cache' };
    return { listed: false, source: usReady ? 'ftc_registry_cache' : 'crtc_dncl_cache' };
  }
  const real = upstreamDncCheck(phone);
  if (real.checked) return { listed: real.listed, source: real.source };
  return { listed: false, source: 'dnc_cache_miss' };
}

export function complianceCacheStats(): RegistryHealth {
  maybeReload();
  const dncRecords = state.dnc?.size ?? 0;
  const dncCaRecords = state.dncCa?.size ?? 0;
  const litRecords = state.litigators?.size ?? 0;
  return {
    dnc: {
      ready: dncRecords > 0,
      records: dncRecords,
      refreshed_at: isoMtime(DNC_FILE),
      file: DNC_FILE,
    },
    dnc_ca: {
      ready: dncCaRecords > 0,
      records: dncCaRecords,
      refreshed_at: isoMtime(DNC_CA_FILE),
      file: DNC_CA_FILE,
    },
    litigator: {
      ready: litRecords > 0,
      records: litRecords,
      refreshed_at: isoMtime(LITIGATOR_FILE),
      file: LITIGATOR_FILE,
    },
  };
}

export function persistRegistryMeta() {
  const health = complianceCacheStats();
  try {
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(
      META_FILE,
      JSON.stringify({ updated_at: new Date().toISOString(), ...health }, null, 2),
    );
  } catch {}
  return health;
}

export function buildDataSourceReceipts(opts?: { upstream_live?: boolean; telnyx_configured?: boolean }): DataSourceReceipt[] {
  const h = complianceCacheStats();
  const telnyx = !!opts?.telnyx_configured || !!process.env.TELNYX_API_KEY;
  return [
    {
      id: 'ftc_dnc',
      vendor: 'FTC National Do Not Call Registry',
      status: h.dnc.ready ? 'loaded' : 'missing',
      refreshed_at: h.dnc.refreshed_at ?? undefined,
      records: h.dnc.records,
      fix_hint: h.dnc.ready ? undefined : 'Create a free SAN account at telemarketing.donotcall.gov, download the file into .data/dnc-us.txt, or set DNC_REGISTRY_URL and run the sync cron.',
    },
    {
      id: 'crtc_dncl',
      vendor: 'CRTC Canada National Do Not Call List',
      status: h.dnc_ca.ready ? 'loaded' : 'missing',
      refreshed_at: h.dnc_ca.refreshed_at ?? undefined,
      records: h.dnc_ca.records,
      fix_hint: h.dnc_ca.ready ? undefined : 'Registrant access via the CRTC DNCL → download into .data/dnc-ca.txt, or set DNC_CA_REGISTRY_URL.',
    },
    {
      id: 'litigator_trap',
      vendor: 'TCPA litigator list',
      status: h.litigator.ready ? 'loaded' : 'missing',
      refreshed_at: h.litigator.refreshed_at ?? undefined,
      records: h.litigator.records,
      fix_hint: h.litigator.ready ? undefined : 'Vendor export (Blacklist Alliance / DNC.com / RealValidation) → .data/litigators.txt, or set LITIGATOR_REGISTRY_URL.',
    },
    { id: 'quiet_hours', vendor: 'NPA timezone map', status: 'derived' },
    { id: 'e164', vendor: 'E.164 normalization', status: 'derived' },
    {
      id: 'telnyx_hlr',
      vendor: 'Telnyx Number Lookup',
      // 'missing' here is receipt-perspective: this source did not contribute to
      // the decision being receipted (key present but cache/mock was used).
      status: opts?.upstream_live ? 'live' : 'missing',
      fix_hint: telnyx ? undefined : 'Create an API key at portal.telnyx.com and set TELNYX_API_KEY.',
    },
    {
      id: 'fcc_rndb',
      vendor: 'FCC RNDB',
      status: reassignedConfigured() ? 'live' : 'missing',
      fix_hint: reassignedConfigured() ? undefined : 'Full-stack checks run REVIEW until a source is set: RNDB_API_URL + RNDB_API_KEY, or TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN.',
    },
    {
      id: 'trustedform_consent',
      vendor: 'TrustedForm (ActiveProspect) certificate',
      status: process.env.TRUSTEDFORM_API_KEY ? 'live' : 'missing',
      fix_hint: process.env.TRUSTEDFORM_API_KEY ? undefined : 'Set TRUSTEDFORM_API_KEY to verify consent certificates; without it a cert URL yields REVIEW (consent_cert_unverified).',
    },
    { id: 'consent_declared', vendor: 'Customer consent record', status: 'customer' },
  ];
}
