export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { upstreamEmail } from '../../../../lib/upstream';
import { costFor } from '../../../../lib/credits';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../lib/auth';

// POST /api/v1/verify_email {email}
export async function POST(req: Request) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401 });
  }

  const started = Date.now();
  const ip = clientIp(req);
  const rl = rateLimit('v1:' + ip);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const { email } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 });

  const realKeys = !!(process.env.REOON_API_KEY || process.env.ZEROBOUNCE_API_KEY);
  if (realKeys && !acc) {
    return NextResponse.json({ error: 'api_key_required', signup: '/api/auth/signup', docs: '/for-agents' }, { status: 401 });
  }

  const cost = costFor('email');
  if (acc && !creditsAvailable(acc, cost)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing' }, { status: 402 });
  }
  const result = await upstreamEmail(email);
  if (acc) {
    const m = await meter(acc, cost, '/api/v1/verify_email:email');
    (result as any).credits_left = m.creditsLeft;
  }
  return NextResponse.json({ ...result, latency_ms: Date.now() - started });
}
