// ── FCC Reassigned Numbers Database (RNDB) adapter ──────────────────────────
//
// A reassigned number is the single biggest TCPA trap: the consumer consented,
// then the carrier reassigned the number to someone else who never consented.
// The gate must answer "was this number reassigned SINCE the consent date?"
// from a reassignment provider instead of guessing.
//
// Two swappable live paths (probe order):
//   1. Generic HTTP provider  — RNDB_API_URL + RNDB_API_KEY
//        GET {RNDB_API_URL}?phone={e164}   Authorization: Bearer {RNDB_API_KEY}
//        body: { "reassigned": true/false, "last_reassigned_date"?: "YYYY-MM-DD" }
//        (reassigned.us-style access; point RNDB_API_URL at whatever the
//         vendor documents)
//   2. Twilio Lookup v2 — TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN, with the
//      `reassigned_number` field enabled for that SID:
//        GET https://lookups.twilio.com/v2/PhoneNumbers/{e164}?Fields=reassigned_number
//
// Contract (used by lib/gate.ts):
//   { reassigned: boolean|null,
//     date?: string,                    // last reassignment effective date
//     status: 'live' | 'unavailable' }  // unavailable = no config or call failed
//
// NEVER default to `reassigned:false` when status is 'unavailable' — the gate
// treats unavailable-with-declared-consent as a REVIEW decision, not a pass.

type ReassignedResult = {
  reassigned: boolean | null;
  date?: string;
  status: 'live' | 'unavailable';
};

const TWILIO_LOOKUP_BASE = 'https://lookups.twilio.com/v2/PhoneNumbers';

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

function lastReassignedDate(json: any): string | undefined {
  const raw =
    json?.last_reassigned_date ??
    json?.reassigned_number?.last_verified_date ??
    json?.reassigned_number?.reassigned_date ??
    (typeof json?.date === 'string' ? json.date : undefined);
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return undefined;
}

async function viaGenericProvider(phoneE164: string): Promise<ReassignedResult | null> {
  const url = process.env.RNDB_API_URL?.trim();
  const key = process.env.RNDB_API_KEY?.trim();
  if (!url || !key) return null;
  const json = await fetchJson(
    `${url}${url.includes('?') ? '&' : '?'}phone=${encodeURIComponent(phoneE164)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${key}`, accept: 'application/json' } },
    2500,
  );
  if (!json) return null;
  const flag = json?.reassigned ?? json?.reassigned_number?.reassigned;
  if (typeof flag !== 'boolean') return null;
  return { reassigned: flag, date: lastReassignedDate(json), status: 'live' };
}

async function viaTwilio(phoneE164: string): Promise<ReassignedResult | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) return null;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const json = await fetchJson(
    `${TWILIO_LOOKUP_BASE}/${encodeURIComponent(phoneE164)}?Fields=reassigned_number`,
    { method: 'GET', headers: { Authorization: `Basic ${auth}`, accept: 'application/json' } },
    2500,
  );
  if (!json) return null;
  const reassigned = json?.reassigned_number?.reassigned;
  if (typeof reassigned !== 'boolean') return null;
  return { reassigned, date: lastReassignedDate(json), status: 'live' };
}

export async function checkReassigned(phoneE164: string): Promise<ReassignedResult> {
  const generic = await viaGenericProvider(phoneE164);
  if (generic) return generic;
  const twilio = await viaTwilio(phoneE164);
  if (twilio) return twilio;
  return { reassigned: null, status: 'unavailable' };
}

/** True when at least one reassigned-number source is configured for production use. */
export function reassignedConfigured(): boolean {
  const generic = !!(process.env.RNDB_API_URL?.trim() && process.env.RNDB_API_KEY?.trim());
  const twilio = !!(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim());
  return generic || twilio;
}
