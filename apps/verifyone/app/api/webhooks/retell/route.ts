export const dynamic = 'force-dynamic';

// Retell inbound call screening. Outbound dialing uses REST gate-then-dial.
import { NextRequest, NextResponse } from 'next/server';
import { runInboundScreen } from '../../../../lib/gate';
import { sealEvidence } from '../../../../lib/audit-store';
import { checkAndBumpQuota } from '../../../../lib/audit-store';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../lib/auth';
import {
  platformAllowPayload,
  platformDecisionHeaders,
  platformDenyPayload,
} from '../../../../lib/agent-webhooks';
import { platformPersistenceUnavailableResponse } from '../../../../lib/persistence-response';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function retellResponse(
  payload: Record<string, unknown>,
  decision: 'ALLOW' | 'REVIEW' | 'DENY',
  reason: string,
  evidenceId = '',
) {
  const headers = new Headers(CORS);
  for (const [name, value] of Object.entries(platformDecisionHeaders(decision, reason, evidenceId))) {
    headers.set(name, value);
  }
  return NextResponse.json(payload, { status: 200, headers });
}

function retellDeny(reason: string, evidenceId = '') {
  return retellResponse(platformDenyPayload('retell'), 'DENY', reason, evidenceId);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | null;
  try {
    body = objectValue(await req.json());
  } catch {
    return retellDeny('invalid_json');
  }

  if (body?.event !== 'call_inbound') {
    return NextResponse.json({}, { status: 200, headers: CORS });
  }
  const inbound = objectValue(body.call_inbound);
  const phone = typeof inbound?.from_number === 'string' ? inbound.from_number : '';

  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) return retellDeny('invalid_api_key');

  const ip = clientIp(req);
  const rl = rateLimit('webhook:retell:' + ip, 240);
  if (!rl.ok) return retellDeny('rate_limited');
  if (!phone) return retellDeny('phone_not_found');

  const cost = 1;
  if (!acc) {
    const quota = await checkAndBumpQuota('ip:' + ip);
    if (!quota.allowed) return retellDeny('free_tier_exhausted');
  }
  if (acc && !creditsAvailable(acc, cost)) return retellDeny('insufficient_credits');

  let gate;
  try {
    gate = await runInboundScreen(phone, acc);
  } catch {
    return retellDeny('gate_unavailable_fail_closed');
  }

  let sealed;
  try {
    sealed = await sealEvidence({
      phone,
      channel: 'voice_inbound',
      consent: null,
      decision: gate.decision,
      reason: gate.reason,
      checks: gate.checks,
      callerKey: acc?.email || 'webhook:retell:' + ip,
    });
  } catch {
    return platformPersistenceUnavailableResponse('retell', CORS);
  }
  const { evidence } = sealed;
  if (acc) {
    const m = await meter(acc, cost, '/api/webhooks/retell:inbound');
    if (m.race) console.warn('[billing] credit debit race after Retell gate decision', { email: acc.email, cost });
  }

  if (gate.decision !== 'allow') {
    return retellResponse(platformDenyPayload('retell'), 'DENY', gate.reason, evidence.evidence_id);
  }

  return retellResponse(
    platformAllowPayload('retell', { evidence_id: evidence.evidence_id }),
    'ALLOW',
    gate.reason,
    evidence.evidence_id,
  );
}
