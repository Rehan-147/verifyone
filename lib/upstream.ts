// ============================================================
// REAL UPSTREAM ADAPTERS — Telnyx (phone), Reoon/ZeroBounce (email),
// IPinfo (IP), FTC DNC registry file (free).
// Every adapter: real API when key present -> graceful fallback to the
// deterministic mock when missing/erroring, with the SAME return shape.
// Paste keys into .env and the whole product goes live. No other changes.
// ============================================================
import { validatePhone, verifyEmail, ipLookup } from './validators';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h freshness promise (matches fresh_for_hours)
const cache = new Map<string, { v: unknown; exp: number }>();

// best-effort persistence so cache survives dev reloads
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs'), path = require('path');
  const f = path.join(process.cwd(), '.data', 'cache.json');
  if (fs.existsSync(f)) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) {
        const e = v as { v: unknown; exp: number };
        if (e.exp > Date.now()) cache.set(k, e);
      }
    } catch {}
  }
  const flush = () => { try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(Object.fromEntries(cache))); } catch {} };
  setInterval(flush, 60_000).unref?.();
} catch {}

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  const v = await fn();
  cache.set(key, { v, exp: Date.now() + TTL_MS });
  return v;
}

export function peekCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  return null;
}
export function cacheSource<T>(v: T, wasCached: boolean) {
  if (wasCached && v && typeof v === 'object') return { ...(v as object), cached: true, fresh_for_hours: 24 };
  return v;
}

async function jget(url: string, headers?: Record<string, string>) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`upstream_${r.status}`);
  return r.json();
}

type PhoneUpstreamOpts = { allow_network?: boolean; timeout_ms?: number };

function formatTelnyxResult(data: Record<string, unknown>, mock: ReturnType<typeof validatePhone>, source: 'telnyx' | 'telnyx_cache' | 'mock_fallback') {
  const carrier = data?.carrier as Record<string, unknown> | undefined;
  const portability = data?.portability as Record<string, unknown> | undefined;
  const status = data?.status as Record<string, unknown> | undefined;
  const carrierName = (carrier?.name as string) || mock.carrier;
  const lineType = String(portability?.line_type || carrier?.type || 'unknown').toLowerCase();
  const deactivated = status?.deactivated === true;
  const country =
    data?.country_code === 'US' ? 'USA' : data?.country_code === 'GB' ? 'UK' : data?.country_code === 'IN' ? 'India' : mock.country;
  const valid = !deactivated && (data?.phone_number ? true : mock.valid);
  return {
    valid,
    isValid: valid,
    country,
    carrier: carrierName,
    lineType,
    disconnected: deactivated,
    riskScore: valid ? (deactivated ? 85 : lineType === 'voip' ? 45 : 12) : 92,
    riskLevel: valid ? (deactivated || lineType === 'voip' ? 'medium' : 'low') : 'high',
    ocn: (carrier?.urn as string) || mock.ocn,
    lrn: mock.lrn,
    ported: !!portability?.ported_status && portability.ported_status !== 'none',
    dnc: mock.dnc,
    source,
  };
}

// ---------------- PHONE (Telnyx Number Lookup) ----------------
export async function upstreamPhone(phone: string, opts?: PhoneUpstreamOpts) {
  const key = process.env.TELNYX_API_KEY;
  const mock = validatePhone(phone);
  const cacheKey = `telnyx:${phone}`;
  const cachedData = peekCache<Record<string, unknown>>(cacheKey);
  if (cachedData) {
    return formatTelnyxResult(cachedData, mock, 'telnyx_cache');
  }
  if (opts?.allow_network === false || !key) return { ...mock, source: 'mock' as const, disconnected: false };

  const timeoutMs = opts?.timeout_ms ?? 8000;
  try {
    const data = await Promise.race([
      cached(cacheKey, async () => {
        const r = await jget(`https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(phone)}`, {
          Authorization: `Bearer ${key}`,
        });
        return (r.data ?? {}) as Record<string, unknown>;
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('telnyx_timeout')), timeoutMs)),
    ]);
    return formatTelnyxResult(data, mock, 'telnyx');
  } catch {
    return { ...mock, source: 'mock_fallback' as const };
  }
}

// ---------------- EMAIL (Reoon preferred, ZeroBounce supported) ----------------
export async function upstreamEmail(email: string) {
  const mock = verifyEmail(email);
  try {
    if (process.env.REOON_API_KEY) {
      const d = await cached(`reoon:${email}`, () => jget(
        `https://leads.reoon.com/email-verifier-v1/?email=${encodeURIComponent(email)}&mode=power&api_key=${process.env.REOON_API_KEY}`));
      const status = String(d?.status || 'unknown').toLowerCase();
      const valid = status === 'valid';
      return {
        valid, domain: d?.domain || mock.domain,
        disposable: d?.disposable === true || /disposable/.test(status),
        mx: d?.mx_record !== false,
        catchAll: d?.is_catchall === true || status === 'catch-all' || status === 'catch_all',
        role: d?.is_role === true,
        riskScore: valid ? 8 : status.includes('disposable') ? 90 : status === 'unknown' ? 55 : 95,
        source: 'reoon' as const,
      };
    }
    if (process.env.ZEROBOUNCE_API_KEY) {
      const d = await cached(`zb:${email}`, () => jget(
        `https://api.zerobounce.net/v2/validate?email=${encodeURIComponent(email)}&api_key=${process.env.ZEROBOUNCE_API_KEY}`));
      const status = String(d?.status || 'unknown').toLowerCase();
      const valid = status === 'valid';
      return {
        valid, domain: mock.domain,
        disposable: d?.disposable === 'true' || status.includes('disposable'),
        mx: status !== 'invalid',
        catchAll: status === 'catch-all',
        role: d?.status === 'role_address' || /role/.test(String(d?.sub_status || '')),
        riskScore: valid ? 8 : status === 'catch-all' ? 55 : status === 'unknown' ? 60 : 95,
        source: 'zerobounce' as const,
      };
    }
  } catch {}
  return { ...mock, source: 'mock' as const };
}

// ---------------- IP (IPinfo) ----------------
export async function upstreamIP(ip: string) {
  const mock = ipLookup(ip);
  const token = process.env.IPINFO_TOKEN;
  if (!token) return { ...mock, source: 'mock' as const };
  try {
    const d = await cached(`ipinfo:${ip}`, () => jget(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${token}`));
    if (d?.error) return { ...mock, source: 'mock_fallback' as const };
    const privacy = d?.privacy ?? {};
    const hosting = privacy.hosting === true;
    return {
      valid: !!d?.ip,
      country: d?.country || mock.country,
      city: d?.city || mock.city,
      isp: d?.org || mock.isp,
      fraudScore: hosting ? 55 : 10,
      proxy: privacy.proxy === true,
      tor: privacy.tor === true,
      vpn: privacy.vpn === true,
      hosting,
      source: 'ipinfo' as const,
    };
  } catch {
    return { ...mock, source: 'mock_fallback' as const };
  }
}

// ---------------- DNC: FTC registry file (free, self-hosted) ----------------
// Drop the FCC registry download (full file, >=31-day refresh) as .data/dnc-us.txt,
// one E.164 or 10-digit number per line. Gate uses it automatically.
let dncSet: Set<string> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs'), path = require('path');
  const f = path.join(process.cwd(), '.data', 'dnc-us.txt');
  if (fs.existsSync(f)) {
    dncSet = new Set(
      String(fs.readFileSync(f, 'utf8')).split('\n')
        .map((l: string) => l.replace(/[^0-9]/g, '').slice(-10))
        .filter((l: string) => l.length === 10)
    );
  }
} catch {}

export function dncCheck(phone: string): { listed: boolean; source: string; checked: boolean } {
  const n = phone.replace(/[^0-9]/g, '').slice(-10);
  if (dncSet && n.length === 10) {
    return { listed: dncSet.has(n), source: 'ftc_registry_file', checked: true };
  }
  return { listed: false, source: 'file_not_loaded', checked: false };
}
