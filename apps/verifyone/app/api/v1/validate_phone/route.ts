import { NextResponse } from 'next/server';
import { upstreamPhone } from '../../../../lib/upstream';
import { costFor } from '../../../../lib/credits';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../lib/auth';

// POST /api/v1/validate_phone {phone}
// Auth: optional (works keyless on mock; real upstream requires a key with credits)
export async function POST(req: Request) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401 });
  }

  const started = Date.now();
  const ip = clientIp(req);
  const rl = rateLimit('v1:' + ip);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const { phone } = await req.json().catch(() => ({}));
  if (!phone) return NextResponse.json({ error: 'phone_required' }, { status: 400 });

  const realKeys = !!(process.env.TELNYX_API_KEY || process.env.TWILIO_ACCOUNT_SID);
  if (realKeys && !acc) {
    return NextResponse.json({ error: 'api_key_required', signup: '/api/auth/signup', docs: '/for-agents' }, { status: 401 });
  }

  const cost = costFor('phone');
  if (acc && !creditsAvailable(acc, cost)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing' }, { status: 402 });
  }
  const result = await upstreamPhone(phone);
  if (acc) {
    const m = await meter(acc, cost, '/api/v1/validate_phone:phone');
    (result as any).credits_left = m.creditsLeft;
  }
  return NextResponse.json({ ...result, latency_ms: Date.now() - started });
}
