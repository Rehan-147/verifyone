// Generic Integration Adapter — works for every catalogued provider.
// Normalizes whatever a given CRM/automation tool happens to call the field, then routes
// the contact to the Compliance Gate.
//
// Every integration uses one of 3 methods:
// 1. Native webhook (HubSpot, Pipedrive, Salesforce, Shopify, Stripe)
// 2. Zapier/Make/n8n (all others via an HTTP request step)
// 3. Direct API call (Google Sheets, Slack, Telegram)
//
// This file makes no HTTP calls to our own API. A serverless function cannot reliably
// reach its own APP_URL, and a second copy of the decision logic would drift from
// lib/gate.ts. app/api/integrations/[provider]/route.ts forwards the live request into
// the gate route handlers, so auth, metering, rate limits and evidence sealing stay in
// exactly one place.
export type GateTarget = 'phone' | 'email';

export type GateDispatch = {
  target: GateTarget;
  /** Request body for /api/v1/gate/phone or /api/v1/gate/email */
  body: Record<string, unknown>;
  /** Which field we matched, echoed back so integrators can fix their mapping. */
  matched: { phone?: string; email?: string };
};

// Matched case-insensitively, so Phone / PHONE / phoneNumber all resolve.
const PHONE_KEYS = ['phone', 'phonenumber', 'phone_number', 'msisdn', 'mobile', 'mobilenumber', 'mobile_number'];
const EMAIL_KEYS = ['email', 'emailaddress', 'email_address', 'user_email'];

function lowerKeys(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const k = key.toLowerCase();
    if (!(k in out)) out[k] = obj[key];
  }
  return out;
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  // Sheets and CRM numeric fields arrive unquoted.
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function pick(payload: Record<string, any>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = asString(payload[k]);
    if (v) return v;
  }
  return undefined;
}

// Three shapes show up in the wild: HubSpot webhooks send properties as { phone: { value } },
// Zapier/Make send line items as [{ key, value }] or [{ property, property_value }], and a
// Zapier code step can hand over bundle.inputData as that bare array. All collapse to
// name -> value.
function collapsePairs(props: unknown): Record<string, any> {
  if (!props || typeof props !== 'object') return {};
  const out: Record<string, any> = {};
  if (Array.isArray(props)) {
    for (const p of props) {
      const name = p?.property ?? p?.property_name ?? p?.name ?? p?.key;
      if (typeof name === 'string') out[name] = p?.property_value ?? p?.value;
    }
    return out;
  }
  for (const [name, v] of Object.entries(props as Record<string, any>)) {
    out[name] = v && typeof v === 'object' && 'value' in v ? (v as any).value : v;
  }
  return out;
}

// Zapier/Make/CRM payloads are inconsistent about nesting; HubSpot wraps in properties,
// Salesforce-style tools in contact. Top-level fields win over nested ones.
function flatten(raw: Record<string, any>): Record<string, any> {
  const source = raw?.input?.data ?? raw ?? {};
  const input = Array.isArray(source) ? collapsePairs(source) : source;
  const contact = input.contact && typeof input.contact === 'object' ? input.contact : {};
  return { ...collapsePairs(input.properties), ...contact, ...input };
}

// An unrecognized consent token stays 'none', which the gate treats as no consent on file.
// Fail-closed on purpose: a mis-mapped CRM field must never manufacture permission to dial.
function normalizeConsent(payload: Record<string, any>): Record<string, unknown> {
  const raw = payload.consent;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  const type = String(typeof raw === 'string' ? raw : payload.consent_type ?? '').toLowerCase();
  const known = type === 'express_written' || type === 'ebr';
  return {
    declared: payload.consent_declared === true || known,
    type: known ? type : 'none',
  };
}

export function toGateDispatch(raw: Record<string, any>): GateDispatch | null {
  const payload = lowerKeys(flatten(raw ?? {}));
  const phone = pick(payload, PHONE_KEYS);
  const email = pick(payload, EMAIL_KEYS);
  if (!phone && !email) return null;

  if (!phone) return { target: 'email', body: { email }, matched: { email } };

  return {
    target: 'phone',
    body: {
      phone,
      channel: payload.channel === 'sms' ? 'sms' : 'voice',
      consent: normalizeConsent(payload),
      ...(payload.profile ? { profile: payload.profile } : {}),
      ...(payload.mode ? { mode: payload.mode } : {}),
    },
    matched: { phone },
  };
}
