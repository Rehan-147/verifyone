// GET /api/billing/me (Authorization: Bearer vk_live_...) -> account status
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, hasKeyHeader } from '../../../../lib/auth';

export async function GET(req: NextRequest) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401 });
  }

  if (!acc) return NextResponse.json({ error: 'api_key_required', signup: '/api/auth/signup' }, { status: 401 });
  return NextResponse.json({
    email: acc.email,
    plan: acc.plan,
    credits: acc.credits,
    created_at: acc.createdAt,
    last_used_at: acc.lastUsedAt,
    manage: 'Payments are processed by Dodo Payments (merchant of record).',
  });
}
