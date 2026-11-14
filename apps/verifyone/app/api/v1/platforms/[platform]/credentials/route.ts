export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { deletePlatformCredential, getPlatformCredential, ownerKeyFor, putPlatformCredential, type CredentialDefaults, type VoicePlatform } from '@/lib/platform-credentials';

export const runtime = 'nodejs';
type Params = { params: { platform: string } };
function parsePlatform(value: string): VoicePlatform | null { return value === 'vapi' || value === 'retell' ? value : null; }
function authError() { return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401 }); }
function safeError(err: unknown) {
  const code = err instanceof Error ? err.message : '';
  if (code === 'credentials_key_missing' || code === 'persistence_unavailable') return NextResponse.json({ error: code }, { status: 503 });
  return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });
}
function defaultsFor(platform: VoicePlatform, input: unknown): CredentialDefaults | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const names = platform === 'vapi' ? ['assistant_id', 'phone_number_id'] : ['agent_id', 'from_number'];
  const result: CredentialDefaults = {};
  for (const name of names) {
    if (o[name] !== undefined) {
      if (typeof o[name] !== 'string' || !o[name].trim()) return null;
      result[name] = o[name].trim();
    }
  }
  return result;
}
function summary(platform: VoicePlatform, row: { keyLast4: string; defaults: CredentialDefaults; verifiedAt: string | null }) {
  return { platform, key_last4: row.keyLast4, defaults: row.defaults, verified_at: row.verifiedAt };
}

export async function PUT(req: NextRequest, { params }: Params) {
  const platform = parsePlatform(params.platform);
  if (!platform) return NextResponse.json({ error: 'unsupported_platform' }, { status: 404 });
  const acc = await authenticate(req);
  if (!acc) return authError();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.api_key !== 'string' || !body.api_key.trim()) return NextResponse.json({ error: 'api_key_required' }, { status: 400 });
  const defaults = defaultsFor(platform, body.defaults);
  if (!defaults) return NextResponse.json({ error: 'invalid_defaults' }, { status: 400 });
  try {
    const row = await putPlatformCredential(ownerKeyFor(acc), platform, body.api_key.trim(), defaults);
    return NextResponse.json({ ...summary(platform, row), stored: true });
  } catch (err) { return safeError(err); }
}

export async function GET(req: NextRequest, { params }: Params) {
  const platform = parsePlatform(params.platform);
  if (!platform) return NextResponse.json({ error: 'unsupported_platform' }, { status: 404 });
  const acc = await authenticate(req);
  if (!acc) return authError();
  try {
    const row = await getPlatformCredential(ownerKeyFor(acc), platform);
    return row ? NextResponse.json(summary(platform, row)) : NextResponse.json({ error: 'platform_not_connected' }, { status: 404 });
  } catch (err) { return safeError(err); }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const platform = parsePlatform(params.platform);
  if (!platform) return NextResponse.json({ error: 'unsupported_platform' }, { status: 404 });
  const acc = await authenticate(req);
  if (!acc) return authError();
  try {
    await deletePlatformCredential(ownerKeyFor(acc), platform);
    return NextResponse.json({ deleted: true, platform });
  } catch (err) { return safeError(err); }
}
