// POST /api/auth/signup { email } -> { api_key } (shown once, stored hashed)
// MVP: no password yet. Prod: email OTP verification before key issuance.
import { NextRequest, NextResponse } from 'next/server';
import { createAccount, rateLimit } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = rateLimit('signup:' + ip, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const { email } = await req.json().catch(() => ({ email: '' }));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'valid_email_required' }, { status: 400 });
  }

  const { key, account } = await createAccount(email, 'FREE');
  return NextResponse.json({
    api_key: key,
    plan: account.plan,
    credits: account.credits,
    notice: 'Store this key now — it is shown only once. We store only a SHA-256 hash.',
    docs: '/for-agents',
  });
}
