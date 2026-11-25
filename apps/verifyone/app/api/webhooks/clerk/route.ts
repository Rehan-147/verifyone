export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { disableOrganization, getOrCreateOrganization } from '@/lib/orgs';

export const runtime = 'nodejs';

type ClerkOrgEvent = {
  type: string;
  data?: {
    id?: string;
    name?: string;
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'webhook_secret_not_configured' }, { status: 503 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing_svix_headers' }, { status: 400 });
  }

  const payload = await req.text();
  let evt: ClerkOrgEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as unknown as ClerkOrgEvent;
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  const orgId = evt.data?.id;
  if (!orgId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    if (evt.type === 'organization.created' || evt.type === 'organization.updated') {
      await getOrCreateOrganization(orgId, evt.data?.name);
    } else if (evt.type === 'organization.deleted') {
      await disableOrganization(orgId);
    }
    return NextResponse.json({ ok: true, type: evt.type });
  } catch {
    return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });
  }
}
