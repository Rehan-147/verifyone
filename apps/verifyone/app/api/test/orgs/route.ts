export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dbEnabled } from '@/lib/db';
import { createOrgApiKey, getOrCreateOrganization } from '@/lib/orgs';

export const runtime = 'nodejs';

function hooksEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.VERIFYONE_TEST_HOOKS === '1';
}

export async function POST(req: NextRequest) {
  if (!hooksEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const clerkOrgId = typeof body.clerkOrgId === 'string' && body.clerkOrgId.trim()
    ? body.clerkOrgId.trim()
    : `org_test_${crypto.randomBytes(6).toString('hex')}`;
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Test Org';
  const keyName = typeof body.keyName === 'string' && body.keyName.trim() ? body.keyName.trim() : 'Test key';

  const org = await getOrCreateOrganization(clerkOrgId, name);
  const { key, record } = await createOrgApiKey(org.id, keyName, 'user_test');
  return NextResponse.json(
    {
      org: { id: org.id, clerkOrgId: org.clerkOrgId, name: org.name, plan: org.plan, credits: org.credits },
      api_key: key,
      key_id: record.id,
    },
    { status: 201 },
  );
}
