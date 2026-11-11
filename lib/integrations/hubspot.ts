// HubSpot integration — gate a contact's phone number, then write the verdict back
// as HubSpot contact properties.
//
// Calls runPhoneGate in-process, which is the same compliance ladder that
// POST /api/v1/gate/phone uses. Deliberately NOT an HTTP self-call to our own API:
// a serverless function cannot reliably reach its own APP_URL, and duplicating the
// ladder here would let the two implementations drift apart.
//
// Exposed at POST /api/webhooks/hubspot, authenticated by HubSpot's v3 webhook signature
// rather than a caller key. Still NOT metered — this path does not deduct credits, so credit
// accounting has to be wired in before it can be treated as billable usage.
import crypto from 'crypto';
import { runPhoneGate } from '../gate';
import { sealEvidence } from '../audit-store';
import { formatPublicGateResponse } from '../gate-contract';

type GateConsent = { declared?: boolean; type?: 'express_written' | 'ebr' | 'none' };

export type HubSpotGatePayload = {
  contactId?: string;
  phone?: string;
  email?: string;
  channel?: 'voice' | 'sms';
  consent?: GateConsent;
};

/** One entry of the array HubSpot POSTs to a contact subscription. */
export type HubSpotWebhookEvent = {
  subscriptionId?: number;
  portalId?: number;
  appId?: number;
  eventId?: number;
  occurredAt?: number;
  subscriptionType?: string;
  objectId?: number | string;
  propertyName?: string;
  message?: string;
};

const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

/** HubSpot's documented replay window for x-hubspot-request-timestamp. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureVerdict = { ok: true } | { ok: false; reason: string };

function timingSafeEqualStr(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Verifies the v3 signature HubSpot sends in `x-hubspot-signature-v3`:
 * base64 HMAC-SHA256, keyed with the app client secret, over
 * `method + requestUri + rawBody + timestamp` concatenated with no separators,
 * where method is uppercase and timestamp is the unmodified `x-hubspot-request-timestamp`
 * value in epoch seconds. The v2 `x-hubspot-signature` scheme (plain SHA-256, no timestamp)
 * is deliberately not accepted — it carries no replay protection.
 *
 * The raw body must be the exact bytes received: re-serializing the JSON changes the digest.
 */
export function verifyHubSpotSignature(opts: {
  rawBody: string;
  requestUrl: URL;
  headers: Headers;
  method: string;
  signature: string | null;
  timestamp: string | null;
}): SignatureVerdict {
  const secret = process.env.HUBSPOT_APP_SECRET || '';
  // Without the secret every signature "matches" nothing, so failing closed here is the only
  // honest answer — an unverified gate call would let anyone PATCH contacts.
  if (!secret) return { ok: false, reason: 'hubspot_app_secret_not_configured' };
  if (!opts.signature) return { ok: false, reason: 'x_hubspot_signature_v3_header_missing' };
  if (!opts.timestamp) return { ok: false, reason: 'x_hubspot_request_timestamp_missing' };
  if (!Number.isFinite(Number(opts.timestamp))) return { ok: false, reason: 'x_hubspot_request_timestamp_malformed' };

  const age = Math.abs(Date.now() / 1000 - Number(opts.timestamp));
  if (age > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp_outside_tolerance' };

  const method = opts.method.toUpperCase();
  // HubSpot signs the URL it dialed, but the request reaches us with whatever origin the
  // platform's proxy reports — under next start req.url is literally http://localhost:<port>/…,
  // and on Vercel it is an internal origin. So the public origin rebuilt from the forwarded
  // headers is tried first, then path+query, then the URL as received. All three need the same
  // secret, so the extra candidates cost nothing in security.
  const pathAndQuery = opts.requestUrl.pathname + opts.requestUrl.search;
  const first = (v: string | null) => v?.split(',')[0]?.trim();
  const proto = first(opts.headers.get('x-forwarded-proto')) || opts.requestUrl.protocol.replace(/:$/, '');
  const host = first(opts.headers.get('x-forwarded-host')) || opts.headers.get('host') || opts.requestUrl.host;
  const uris = [`${proto}://${host}${pathAndQuery}`, pathAndQuery, opts.requestUrl.toString()];

  for (const uri of uris) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${method}${uri}${opts.rawBody}${opts.timestamp}`)
      .digest('base64');
    if (timingSafeEqualStr(expected, opts.signature)) return { ok: true };
  }
  return { ok: false, reason: 'signature_mismatch' };
}

export type ContactFetch =
  | { properties: Record<string, string> }
  | { error: string; status?: number; transient?: boolean };

/** Reads the properties the gate needs. `extraProperties` carries e.g. the consent property. */
export async function fetchHubSpotContact(contactId: string, extraProperties: string[] = []): Promise<ContactFetch> {
  if (!process.env.HUBSPOT_TOKEN) return { error: 'hubspot_not_configured' };
  const properties = ['phone', 'email', ...extraProperties].join(',');
  const url = `${HUBSPOT_CONTACTS_URL}/${encodeURIComponent(contactId)}?properties=${encodeURIComponent(properties)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}` } });
  } catch (err) {
    console.error(`[hubspot] contact GET ${contactId} network error:`, err);
    return { error: 'contact_fetch_failed', transient: true };
  }
  if (res.status === 404) return { error: 'contact_not_found' };
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    console.error(`[hubspot] contact GET ${contactId} ${res.status}: ${detail}`);
    // 5xx and rate limits are worth a HubSpot redelivery; 4xx (bad token) is not.
    return { error: 'contact_fetch_failed', status: res.status, transient: res.status >= 500 || res.status === 429 };
  }
  const json = await res.json().catch(() => null);
  return { properties: (json?.properties ?? {}) as Record<string, string> };
}

export async function handleHubSpotWebhook(payload: HubSpotGatePayload, apiKey: string) {
  if (!payload?.contactId) return { error: 'contactId_required' as const };
  if (!payload.phone) {
    return { error: 'phone_required' as const, message: 'Contact has no phone number to gate — nothing written to HubSpot.' };
  }
  if (!process.env.HUBSPOT_TOKEN) {
    return { error: 'hubspot_not_configured' as const, message: 'Set HUBSPOT_TOKEN (HubSpot private app token) — see .env.example.' };
  }

  const channel = payload.channel === 'sms' ? 'sms' : 'voice';
  const consent: GateConsent = payload.consent ?? { declared: false, type: 'none' };

  let gate: Awaited<ReturnType<typeof runPhoneGate>>;
  try {
    gate = await runPhoneGate({ phone: String(payload.phone), channel, consent, mode: 'fail_closed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[hubspot] gate failed for contact ${payload.contactId}: ${message} — skipping PATCH`);
    return { error: 'gate_failed' as const, message };
  }

  const { evidence } = await sealEvidence({
    phone: String(payload.phone),
    channel,
    consent,
    decision: gate.decision,
    reason: gate.reason,
    checks: gate.checks,
    callerKey: apiKey || 'hubspot',
  });

  const pub = formatPublicGateResponse(gate, {
    evidence_id: evidence.evidence_id,
    profile: gate.profile,
    upstream_live: gate.upstream_live,
  });

  // Only PATCH once a real verdict exists, so HubSpot never receives empty properties.
  const properties = {
    verifyone_status: pub.decision,
    verifyone_reason: pub.reason,
    verifyone_evidence_id: pub.evidence_id,
  };
  if (!properties.verifyone_status || !properties.verifyone_evidence_id) {
    console.error(`[hubspot] incomplete gate verdict for contact ${payload.contactId} — skipping PATCH`);
    return { error: 'gate_incomplete' as const, gate: pub };
  }

  let patch: Response | null = null;
  try {
    patch = await fetch(`${HUBSPOT_CONTACTS_URL}/${encodeURIComponent(payload.contactId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });
  } catch (err) {
    console.error(`[hubspot] PATCH network error for contact ${payload.contactId}:`, err);
    return { error: 'hubspot_patch_failed' as const, detail: 'network error', gate: pub };
  }

  if (!patch.ok) {
    const detail = await patch.text().catch(() => '');
    console.error(`[hubspot] PATCH ${patch.status} for contact ${payload.contactId}: ${detail.slice(0, 300)}`);
    return { error: 'hubspot_patch_failed' as const, status: patch.status, detail, gate: pub };
  }

  return { ok: true, contactId: payload.contactId, properties, gate: pub };
}
