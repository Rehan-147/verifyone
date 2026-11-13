// Vapi inbound assistant-request screening. Outbound dialing uses REST gate-then-dial.
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

function vapiResponse(
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

function vapiDeny(reason: string, evidenceId = '') {
  return vapiResponse(platformDenyPayload('vapi'), 'DENY', reason, evidenceId);
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
    return vapiDeny('invalid_json');
  }

  const message = objectValue(body?.message);
  if (message?.type !== 'assistant-request') {
    return NextResponse.json({}, { status: 200, headers: CORS });
  }

  const assistantId = req.nextUrl.searchParams.get('assistant_id')?.trim();
  if (!assistantId) {
    const headers = new Headers(CORS);
    headers.set('x-verifyone-decision', 'DENY');
    headers.set('x-verifyone-reason', 'assistant_id_missing');
    return NextResponse.json(platformDenyPayload('vapi'), { status: 200, headers });
  }

  const call = objectValue(message.call);
  const callCustomer = objectValue(call?.customer);
  const messageCustomer = objectValue(message.customer);
  const phone =
    (typeof callCustomer?.number === 'string' && callCustomer.number) ||
    (typeof messageCustomer?.number === 'string' && messageCustomer.number) ||
    '';

  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) return vapiDeny('invalid_api_key');

  const ip = clientIp(req);
  const rl = rateLimit('webhook:vapi:' + ip, 240);
  if (!rl.ok) return vapiDeny('rate_limited');
  if (!phone) return vapiDeny('phone_not_found');

  const cost = 1;
  if (!acc) {
    const quota = await checkAndBumpQuota('ip:' + ip);
    if (!quota.allowed) return vapiDeny('free_tier_exhausted');
  }
  if (acc && !creditsAvailable(acc, cost)) return vapiDeny('insufficient_credits');

  let gate;
  try {
    gate = await runInboundScreen(phone, acc);
  } catch {
    return vapiDeny('gate_unavailable_fail_closed');
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
      callerKey: acc?.email || 'webhook:vapi:' + ip,
    });
  } catch {
    return platformPersistenceUnavailableResponse('vapi', CORS);
  }
  const { evidence } = sealed;
  if (acc) {
    const m = await meter(acc, cost, '/api/webhooks/vapi:inbound');
    if (m.race) console.warn('[billing] credit debit race after Vapi gate decision', { email: acc.email, cost });
  }

  if (gate.decision !== 'allow') {
    return vapiResponse(platformDenyPayload('vapi'), 'DENY', gate.reason, evidence.evidence_id);
  }

  return vapiResponse(
    platformAllowPayload('vapi', { assistantId, evidence_id: evidence.evidence_id }),
    'ALLOW',
    gate.reason,
    evidence.evidence_id,
  );
}
