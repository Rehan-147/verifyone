// Retell pre-call webhook — abort workflow on DENY before connect.
import { NextRequest, NextResponse } from 'next/server';
import { runPhoneGate } from '../../../../lib/gate';
import { sealEvidence } from '../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable } from '../../../../lib/auth';
import { formatPublicGateResponse, isAllowDecision } from '../../../../lib/gate-contract';
import { gateBundleCredits, resolveGateProfile } from '../../../../lib/credits';
import { extractConsent, extractPhoneFromPayload, platformAllowPayload, platformDenyPayload } from '../../../../lib/agent-webhooks';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = rateLimit('webhook:retell:' + ip, 240);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: CORS });
  }

  const phone = extractPhoneFromPayload(body);
  if (!phone) {
    return NextResponse.json({ error: 'phone_not_found' }, { status: 400, headers: CORS });
  }

  const profile = resolveGateProfile(body as { profile?: string; live_hlr?: boolean });
  const consent = extractConsent(body);
  const acc = await authenticate(req);
  if (acc && !creditsAvailable(acc)) {
    // Fail-closed + predictable: an empty balance holds the call under the same
    // deny contract the platform already understands (HTTP 200, not a webhook error).
    return NextResponse.json(
      {
        ...platformDenyPayload('retell', 'insufficient_credits', 'unmetered'),
        note: 'VerifyOne balance is empty — re-up at /pricing. Held fail-closed instead of dialing unmetered.',
      },
      { status: 200, headers: CORS },
    );
  }
  if (acc) await meter(acc, gateBundleCredits(profile, { trustedform: !!consent.trustedform_cert_url }));

  const gate = await runPhoneGate({
    phone,
    channel: 'voice',
    consent,
    profile,
  });

  const { evidence } = await sealEvidence({
    phone,
    channel: 'voice',
    consent,
    decision: gate.decision,
    reason: gate.reason,
    checks: gate.checks,
    callerKey: acc?.email || 'webhook:retell:' + ip,
  });

  const pub = formatPublicGateResponse(gate, {
    evidence_id: evidence.evidence_id,
    latency_ms: Date.now() - started,
    profile,
    bundle_credits: gateBundleCredits(profile),
    live_hlr: profile === 'full_stack',
    upstream_live: gate.upstream_live,
  });

  if (!isAllowDecision(pub)) {
    return NextResponse.json(
      { ...pub, ...platformDenyPayload('retell', pub.reason, pub.evidence_id) },
      { status: 200, headers: CORS },
    );
  }
  return NextResponse.json(
    { ...pub, ...platformAllowPayload('retell', pub.evidence_id, pub.reason) },
    { headers: CORS },
  );
}
