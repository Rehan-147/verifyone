import { NextResponse } from 'next/server';
import { upstreamIP } from '../../../../lib/upstream';
import { costFor } from '../../../../lib/credits';
import { authenticate, meter, rateLimit, creditsAvailable, hasKeyHeader, clientIp } from '../../../../lib/auth';

// POST /api/v1/ip_lookup {ip}
export async function POST(req: Request) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401 });
  }

  const started = Date.now();
  const ip = clientIp(req);
  const rl = rateLimit('v1:' + ip);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const target = body.ip;
  if (!target) return NextResponse.json({ error: 'ip_required' }, { status: 400 });

  if (process.env.IPINFO_TOKEN && !acc) {
    return NextResponse.json({ error: 'api_key_required', signup: '/api/auth/signup', docs: '/for-agents' }, { status: 401 });
  }

  const cost = costFor('ip');
  if (acc && !creditsAvailable(acc, cost)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing' }, { status: 402 });
  }
  const result = await upstreamIP(target);
  if (acc) {
    const m = await meter(acc, cost, '/api/v1/ip_lookup:ip');
    (result as any).credits_left = m.creditsLeft;
  }
  return NextResponse.json({ ...result, latency_ms: Date.now() - started });
}
