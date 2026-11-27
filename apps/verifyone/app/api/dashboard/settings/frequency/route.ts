export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkConfigured } from '@/lib/clerk';
import { dbEnabled } from '@/lib/db';
import { getOrCreateOrganization } from '@/lib/orgs';
import { setOrgCallCap } from '@/lib/frequency';
import { ORG_CALL_CAP_MAX, ORG_CALL_CAP_MIN } from '@/lib/data/state-frequency-rules';

export const runtime = 'nodejs';

async function orgContext(requireAdmin: boolean) {
  if (!clerkConfigured()) return { error: NextResponse.json({ error: 'auth_not_configured' }, { status: 503 }) };
  if (!dbEnabled()) return { error: NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 }) };
  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (!orgId) return { error: NextResponse.json({ error: 'organization_required' }, { status: 400 }) };
  if (requireAdmin && orgRole !== 'org:admin') return { error: NextResponse.json({ error: 'admin_required' }, { status: 403 }) };
  // The organization always comes from the Clerk session, never from the request.
  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  if (org.disabledAt) return { error: NextResponse.json({ error: 'org_disabled' }, { status: 403 }) };
  return { org };
}

export async function GET() {
  const ctx = await orgContext(false);
  if ('error' in ctx) return ctx.error;
  return NextResponse.json({ call_cap_24h: ctx.org.callCap24h ?? null });
}

export async function PUT(req: NextRequest) {
  const ctx = await orgContext(true);
  if ('error' in ctx) return ctx.error;
  const body = await req.json().catch(() => null) as { call_cap_24h?: unknown } | null;
  const raw = body?.call_cap_24h;
  const valid = raw === null || (typeof raw === 'number' && Number.isInteger(raw) && raw >= ORG_CALL_CAP_MIN && raw <= ORG_CALL_CAP_MAX);
  if (!body || !('call_cap_24h' in body) || !valid) {
    return NextResponse.json(
      { error: 'invalid_call_cap', message: `call_cap_24h must be an integer from ${ORG_CALL_CAP_MIN} to ${ORG_CALL_CAP_MAX}, or null.` },
      { status: 400 },
    );
  }
  const cap = await setOrgCallCap(ctx.org.id, raw as number | null);
  return NextResponse.json({ call_cap_24h: cap });
}
