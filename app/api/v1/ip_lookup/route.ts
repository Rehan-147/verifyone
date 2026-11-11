import { NextResponse } from 'next/server';
import { upstreamIP } from '../../../../lib/upstream';
import { authenticate, meter, rateLimit, creditsAvailable } from '../../../../lib/auth';

// POST /api/v1/ip_lookup {ip}
export async function POST(req: Request) {
  const started = Date.now();
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = rateLimit('v1:' + ip);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const target = body.ip;
  if (!target) return NextResponse.json({ error: 'ip_required' }, { status: 400 });

  const acc = await authenticate(req);
  if (process.env.IPINFO_TOKEN && !acc) {
    return NextResponse.json({ error: 'api_key_required', signup: '/api/auth/signup', docs: '/for-agents' }, { status: 401 });
  }

  if (acc && !creditsAvailable(acc)) {
    return NextResponse.json({ error: 'insufficient_credits', reup: '/pricing' }, { status: 402 });
  }
  const result = await upstreamIP(target);
  if (acc) {
    const m = await meter(acc, 1);
    (result as any).credits_left = m.creditsLeft;
  }
  return NextResponse.json({ ...result, latency_ms: Date.now() - started });
}
