// POST /api/integrations/{provider} — generic field-normalizing gate endpoint.
// Customers can call it from their own HTTP workflows; this is not a vendor-specific
// connector, Zapier app, or pre-built automation for every catalogued platform.
//
// Why forward instead of calling our own HTTP URL: a serverless function cannot reliably
// reach its own APP_URL, and re-implementing the ladder here would drift from lib/gate.ts.
// Forwarding keeps auth, credit metering, free-tier quota, rate limits and evidence
// sealing exactly where /api/v1/gate/* already applies them.
import { NextRequest, NextResponse } from 'next/server';
import { POST as gatePhone } from '../../v1/gate/phone/route';
import { POST as gateEmail } from '../../v1/gate/email/route';
import { toGateDispatch } from '@/lib/integrations/adapter';
import { INTEGRATIONS } from '@/lib/integrations/catalog-100';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Same headers (so the caller's API key still authenticates) with the normalized gate
// body, since the original request body can only be read once.
function asGateRequest(req: NextRequest, path: string, body: unknown): NextRequest {
  return new NextRequest(new URL(path, req.nextUrl.origin), {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(body),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const integration = INTEGRATIONS.find((i) => i.slug === params.provider);
  if (!integration) {
    return NextResponse.json(
      { error: 'integration_not_found', provider: params.provider, hint: 'GET /api/integrations/{provider} lists valid slugs' },
      { status: 404, headers: CORS }
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'invalid_json_body', example: { phone: '+14155552120' } }, { status: 400, headers: CORS });
  }

  const dispatch = toGateDispatch(payload as Record<string, any>);
  if (!dispatch) {
    const ipOnly = !!(payload as any).ip || !!(payload as any).IP;
    return NextResponse.json(
      {
        error: 'no_gateable_field',
        message: ipOnly
          ? 'The gate decisions are phone and email. IP signals are served by POST /api/v1/ip_lookup.'
          : 'Send a phone or an email field (any of: phone, phone_number, PhoneNumber, msisdn, mobile, email, email_address — matched case-insensitively, or nested under contact/properties).',
        provider: params.provider,
      },
      { status: 400, headers: CORS }
    );
  }

  const gate =
    dispatch.target === 'email'
      ? await gateEmail(asGateRequest(req, '/api/v1/gate/email', dispatch.body))
      : await gatePhone(asGateRequest(req, '/api/v1/gate/phone', dispatch.body));

  const json = await gate.json().catch(() => ({}));

  // Only the CORS keys are copied back: the gate's content-length no longer matches once
  // the provider envelope is added.
  const headers = new Headers(CORS);
  for (const k of Object.keys(CORS)) {
    const v = gate.headers.get(k);
    if (v) headers.set(k, v);
  }

  return NextResponse.json(
    { provider: params.provider, gate: dispatch.target, matched: dispatch.matched, ...json },
    { status: gate.status, headers }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const integration = INTEGRATIONS.find((i) => i.slug === params.provider);
  if (!integration) {
    return NextResponse.json({ error: 'not_found', count: INTEGRATIONS.length }, { status: 404, headers: CORS });
  }
  return NextResponse.json(
    { ...integration, endpoint: `/api/integrations/${integration.slug}`, gates: integration.fields },
    { headers: CORS }
  );
}
