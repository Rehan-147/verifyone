// Shared phone extraction for Vapi / Retell / generic agent webhooks.
function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export function extractPhoneFromPayload(body: Record<string, unknown>): string | null {
  const paths: unknown[] = [
    body.phone,
    body.to,
    body.to_number,
    body.customerPhoneNumber,
    dig(body, 'call', 'customer', 'number'),
    dig(body, 'call', 'phoneNumber'),
    dig(body, 'message', 'call', 'customer', 'number'),
    dig(body, 'message', 'call', 'phoneNumber'),
    dig(body, 'message', 'customer', 'number'),
    body.from_number,
    dig(body, 'args', 'phone'),
  ];
  for (const p of paths) {
    if (typeof p === 'string' && p.replace(/\D/g, '').length >= 7) return p;
  }
  return null;
}

export function extractConsent(body: Record<string, unknown>) {
  const c = (body.consent || dig(body, 'metadata', 'consent')) as
    | { declared?: boolean; type?: string; trustedform_cert_url?: string; trustedform?: string }
    | undefined;
  const certUrl =
    (typeof c?.trustedform_cert_url === 'string' && c.trustedform_cert_url) ||
    (typeof c?.trustedform === 'string' && c.trustedform) ||
    (typeof (body as any).trustedform_cert_url === 'string' && (body as any).trustedform_cert_url) ||
    (typeof dig(body, 'metadata', 'trustedform_cert_url') === 'string' &&
      (dig(body, 'metadata', 'trustedform_cert_url') as string)) ||
    '';
  const base = {
    declared: false as boolean,
    type: 'none' as 'none' | 'express_written' | 'ebr',
    ...(certUrl ? { trustedform_cert_url: certUrl } : {}),
  };
  if (!c) return base;
  if (c.declared || c.type) {
    if (c.type === 'express_written') return { ...base, declared: !!c.declared, type: 'express_written' as const };
    if (c.type === 'ebr') return { ...base, declared: !!c.declared, type: 'ebr' as const };
  }
  if (certUrl) {
    // A TrustedForm certificate alone is a consent claim; treat it as declared,
    // the certificate verification decides whether it holds up.
    return { ...base, declared: true, type: 'express_written' as const };
  }
  return base;
}

export type VoicePlatform = 'vapi' | 'retell' | 'generic';

export function platformDenyPayload(platform: VoicePlatform, publicReason: string, evidence_id: string) {
  const base = { decision: 'DENY' as const, reason: publicReason, evidence_id, abort_call: true };
  if (platform === 'vapi') {
    return {
      ...base,
      vapi: {
        action: 'endCall',
        endCall: true,
        message: `VerifyOne gate: ${publicReason}`,
        result: { success: false, stop: true },
      },
    };
  }
  if (platform === 'retell') {
    return {
      ...base,
      retell: {
        call_inbound: { override: true, ignore: true },
        end_call: true,
        response: { action: 'hangup', reason: publicReason },
      },
    };
  }
  return base;
}

export function platformAllowPayload(platform: VoicePlatform, evidence_id: string, reason: string) {
  const base = { decision: 'ALLOW' as const, reason, evidence_id, abort_call: false };
  if (platform === 'vapi') {
    return { ...base, vapi: { action: 'continue', endCall: false, result: { success: true } } };
  }
  if (platform === 'retell') {
    return { ...base, retell: { call_inbound: { override: false }, end_call: false } };
  }
  return base;
}
