export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, creditsAvailable, meter, rateLimit } from '@/lib/auth';
import { normalizePhone, sealEvidence } from '@/lib/audit-store';
import { gateBundleCredits, resolveGateProfile } from '@/lib/credits';
import { runPhoneGateDecision } from '@/lib/gate-service';
import { completeDialIdempotency, claimDialIdempotency, getPlatformCredential, ownerKeyFor, releaseDialIdempotency, type CredentialDefaults, type VoicePlatform } from '@/lib/platform-credentials';

export const runtime = 'nodejs';
type Params = { params: { platform: string } };
const unavailableReasons = new Set(['gate_unavailable_fail_closed', 'fail_open_gate_unavailable']);

function jsonError(error: string, status: number) { return NextResponse.json({ error }, { status }); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function safeDefaults(platform: VoicePlatform, input: unknown): CredentialDefaults {
  const o = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const names = platform === 'vapi' ? ['assistant_id', 'phone_number_id'] : ['agent_id', 'from_number'];
  const out: CredentialDefaults = {};
  for (const name of names) if (typeof o[name] === 'string' && o[name].trim()) out[name] = o[name].trim();
  return out;
}
function platformBase(platform: VoicePlatform) {
  if (process.env.NODE_ENV !== 'production') {
    const override = platform === 'vapi' ? process.env.VAPI_API_BASE : process.env.RETELL_API_BASE;
    if (override) return override.replace(/\/$/, '');
  }
  return platform === 'vapi' ? 'https://api.vapi.ai' : 'https://api.retellai.com';
}

export async function POST(req: NextRequest, { params }: Params) {
  const platform = params.platform === 'vapi' || params.platform === 'retell' ? params.platform : null;
  if (!platform) return jsonError('unsupported_platform', 404);
  let acc;
  try { acc = await authenticate(req); } catch { return jsonError('persistence_unavailable', 503); }
  if (!acc) return jsonError('invalid_api_key', 401);
  const idempotencyKey = req.headers.get('idempotency-key')?.trim() || '';
  if (!idempotencyKey) return jsonError('idempotency_key_required', 400);
  if (idempotencyKey.length > 200 || /[^\x21-\x7e]/.test(idempotencyKey)) return jsonError('invalid_idempotency_key', 400);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.phone !== 'string' || !body.phone.trim()) return jsonError('phone_required', 400);
  const phone = normalizePhone(body.phone);
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return jsonError('invalid_phone', 400);

  const ownerKey = ownerKeyFor(acc);
  const rl = rateLimit(`dial:${ownerKey}`, 60, 60_000);
  if (!rl.ok) return jsonError('rate_limited', 429);
  const normalizedBody = { ...body, phone };
  const requestHash = crypto.createHash('sha256').update(`${platform}:${stable(normalizedBody)}`).digest('hex');
  let claim;
  try { claim = await claimDialIdempotency(ownerKey, idempotencyKey, requestHash); }
  catch (err) { return jsonError(err instanceof Error && err.message === 'persistence_unavailable' ? 'persistence_unavailable' : 'persistence_unavailable', 503); }
  if (claim.kind === 'replay') return NextResponse.json(claim.response, { status: claim.status });
  if (claim.kind === 'conflict') return jsonError('idempotency_conflict', 409);
  if (claim.kind === 'in_progress') return jsonError('idempotency_in_progress', 409);
  const releaseAndError = async (error: string, status: number) => {
    try { await releaseDialIdempotency(ownerKey, idempotencyKey); }
    catch { return jsonError('persistence_unavailable', 503); }
    return jsonError(error, status);
  };

  const platformBody = body[platform] && typeof body[platform] === 'object' ? body[platform] as Record<string, unknown> : {};
  let savedCredential;
  try { savedCredential = await getPlatformCredential(ownerKey, platform); }
  catch (err) { return releaseAndError(err instanceof Error && err.message === 'credentials_key_missing' ? 'credentials_key_missing' : 'persistence_unavailable', 503); }
  const credentialDefaults = safeDefaults(platform, savedCredential?.defaults);
  const defaults = { ...credentialDefaults, ...safeDefaults(platform, platformBody) };
  const required = platform === 'vapi' ? ['assistant_id', 'phone_number_id'] : ['from_number'];
  for (const name of required) if (!defaults[name]) return releaseAndError('platform_configuration_required', 400);

  const consent = body.consent && typeof body.consent === 'object' ? body.consent as Record<string, unknown> : {};
  const profile = resolveGateProfile(body as { profile?: string; live_hlr?: boolean });
  const cost = gateBundleCredits(profile, { trustedform: typeof consent.trustedform_cert_url === 'string' });
  if (!creditsAvailable(acc, cost)) return releaseAndError('insufficient_credits', 402);
  let credential;
  try { credential = await getPlatformCredential(ownerKey, platform, true); }
  catch (err) { return releaseAndError(err instanceof Error && err.message === 'credentials_key_missing' ? 'credentials_key_missing' : 'persistence_unavailable', 503); }
  if (!credential) return releaseAndError('platform_not_connected', 400);

  const gateBody = { ...body, phone, mode: 'fail_closed' };
  const result = await runPhoneGateDecision(gateBody, profile, profile === 'full_stack' ? 800 : 95);
  let gateEvidenceId: string;
  try {
    const sealed = await sealEvidence({
      phone,
      channel: 'voice',
      consent: body.consent ?? { declared: false, type: 'none' },
      decision: result.decision,
      reason: result.reason,
      checks: result.checks,
      callerKey: acc.email,
    });
    gateEvidenceId = sealed.evidence.evidence_id;
  } catch {
    return releaseAndError('persistence_unavailable', 503);
  }
  if (!unavailableReasons.has(result.reason)) {
    let debit;
    try { debit = await meter(acc, cost, `/api/v1/dial/${platform}:${profile}`); }
    catch { return releaseAndError('persistence_unavailable', 503); }
    if (!debit.metered) return releaseAndError('insufficient_credits', 402);
    if (debit.race) console.warn('[billing] credit debit race after dial gate decision', { email: acc.email, cost });
  }

  const publicDecision = result.decision === 'allow' ? 'ALLOW' : result.decision === 'review' ? 'REVIEW' : 'DENY';
  if (result.decision !== 'allow') {
    const response = { dialed: false, decision: publicDecision, reason: result.reason, evidence_id: gateEvidenceId };
    await completeDialIdempotency(ownerKey, idempotencyKey, requestHash, 200, response);
    return NextResponse.json(response);
  }

  const apiKey = credential.apiKey;
  const vapi = platform === 'vapi';
  const endpoint = vapi ? `${platformBase(platform)}/call` : `${platformBase(platform)}/v2/create-phone-call`;
  const callBody = vapi
    ? { assistantId: defaults.assistant_id, phoneNumberId: defaults.phone_number_id, customer: { number: phone } }
    : { from_number: defaults.from_number, to_number: phone, ...(defaults.agent_id ? { override_agent_id: defaults.agent_id } : {}) };
  let status = 502;
  let callId: string | undefined;
  let platformStatus: number | undefined;
  let dialReason = 'dial_failed';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    let platformJson: Record<string, unknown>;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(callBody),
        signal: controller.signal,
      });
      platformStatus = response.status;
      platformJson = await response.json().catch(() => ({})) as Record<string, unknown>;
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) {
      const id = vapi ? platformJson.id : platformJson.call_id;
      if (typeof id === 'string' && id) { callId = id; status = 200; dialReason = 'dial_placed'; }
    }
  } catch { /* Never expose provider errors or key-bearing bodies. */ }

  const dialEvidence = await sealEvidence({
    phone,
    channel: 'voice',
    consent: body.consent ?? { declared: false, type: 'none' },
    decision: dialReason === 'dial_placed' ? 'allow' : 'block',
    reason: dialReason,
    checks: { gate_evidence_id: gateEvidenceId, platform, ...(callId ? { platform_call_id: callId } : { platform_status: platformStatus ?? 'timeout_or_unavailable' }) },
    callerKey: acc.email,
  }).catch(() => null);

  const response = status === 200
    ? { dialed: true, platform, call_id: callId, decision: 'ALLOW', evidence_id: gateEvidenceId, dial_evidence_id: dialEvidence?.evidence.evidence_id }
    : { dialed: false, error: 'platform_error', platform_status: platformStatus ?? 502, evidence_id: gateEvidenceId, dial_evidence_id: dialEvidence?.evidence.evidence_id };
  await completeDialIdempotency(ownerKey, idempotencyKey, requestHash, status, response);
  return NextResponse.json(response, { status });
}

