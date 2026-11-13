// ── TrustedForm (ActiveProspect) consent-certificate verification ───────────
//
// A TrustedForm certificate is the lead-gen industry's consent proof: the
// consumer's actual submission was captured (page snapshot, timestamp,
// consent-banner state) and stored at a cert URL like https://cert.trustedform.com/<cert_id>.
//
// Why it matters to the gate: "consent.declared" is customer-supplied and
// worthless in a dispute. A *verified* TrustedForm certificate turns
// "we declared consent" into "here is the independent proof".
//
// Configuration:
//   TRUSTEDFORM_API_KEY  — private API token from the TrustedForm account
//   TRUSTEDFORM_API_URL  — optional override (default https://api.trustedform.com)
//
// Contract (used by lib/gate.ts):
//   { status: 'verified' | 'invalid' | 'unconfigured' | 'error',
//     cert_id?: string, captured_at?: string, checks_url?: string }
//
// Gate behaviour (fail-closed ladder):
//   verified   → consent proof strengthens the decision (receipt attached)
//   invalid    → BLOCK — claimed consent does not exist / does not match
//   unconfigured→ REVIEW (human decides) on the ai-voice consent branch instead
//                 of silent allow — when a cert was supplied but no key exists
//   error      → REVIEW as well (do not pretend the cert is proof)

export type TrustedFormResult = {
  status: 'verified' | 'invalid' | 'unconfigured' | 'error';
  cert_id?: string;
  captured_at?: string;
  checks_url?: string;
};

export const TRUSTEDFORM_DEFAULT_API_URL = 'https://api.trustedform.com';

export function extractTrustedFormCertId(certUrlOrId: string | undefined): string | null {
  if (!certUrlOrId) return null;
  const s = certUrlOrId.trim();
  if (!s) return null;
  // Accept the bare id or the full cert URL — ids are opaque tokens.
  const m = s.match(/trustedform\.com\/([A-Za-z0-9._-]{6,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9._-]{6,}$/.test(s)) return s;
  return null;
}

function capturedAt(json: any): string | undefined {
  const raw = json?.fingerprint?.captured_at ?? json?.cert?.fingerprint?.captured_at ?? json?.captured_at;
  if (typeof raw === 'string' && raw.length >= 10) return raw;
  return undefined;
}

function checksUrl(json: any): string | undefined {
  return typeof json?.check_url === 'string' ? json.check_url : undefined;
}

export async function verifyTrustedForm(
  certUrlOrId: string | undefined,
  opts?: { phone?: string; email?: string }
): Promise<TrustedFormResult> {
  const certId = extractTrustedFormCertId(certUrlOrId);
  if (!certId) return { status: 'invalid' };
  const key = process.env.TRUSTEDFORM_API_KEY?.trim();
  if (!key) return { status: 'unconfigured', cert_id: certId };

  const base = (process.env.TRUSTEDFORM_API_URL?.trim() || TRUSTEDFORM_DEFAULT_API_URL).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/certificates/${encodeURIComponent(certId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}`, accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (res.status === 404 || res.status === 403 || res.status === 410) {
      return { status: 'invalid', cert_id: certId };
    }
    if (!res.ok) return { status: 'error', cert_id: certId };
    const json = (await res.json()) as Record<string, any>;
    if (json?.id) {
      return {
        status: 'verified',
        cert_id: certId,
        captured_at: capturedAt(json),
        checks_url: checksUrl(json),
      };
    }
    return { status: 'error', cert_id: certId };
  } catch {
    return { status: 'error', cert_id: certId };
  }
}
