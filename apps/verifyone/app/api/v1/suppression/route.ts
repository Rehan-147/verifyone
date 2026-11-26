export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticate, hasKeyHeader, rateLimit, clientIp } from '@/lib/auth';
import { ownerKeyFor } from '@/lib/platform-credentials';
import {
  addSuppression,
  isSuppressed,
  listSuppression,
  removeSuppression,
  SUPPRESSION_REASONS,
  type SuppressionReason,
} from '@/lib/suppression';
import { persistenceUnavailableResponse } from '@/lib/persistence-response';

export const runtime = 'nodejs';

const MAX_BULK_PHONES = 10_000;

export async function GET(req: NextRequest) {
  let acc;
  try { acc = await authenticate(req); } catch { return persistenceUnavailableResponse(); }
  if (!acc) {
    return NextResponse.json({ error: hasKeyHeader(req) ? 'invalid_api_key' : 'api_key_required' }, { status: 401 });
  }
  const rl = rateLimit('suppression:get:' + ownerKeyFor(acc), 240);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const ownerKey = ownerKeyFor(acc);
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone');
  try {
    if (phone) {
      const result = await isSuppressed(ownerKey, phone);
      return NextResponse.json({ listed: result.listed, evaluated: result.evaluated, entry_requested_at: result.entry_requested_at ?? null });
    }
    const cursor = searchParams.get('cursor');
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search');
    const page = await listSuppression({ ownerKey, cursor, limit: Number.isFinite(limit) ? limit : 50, searchPhone: search });
    return NextResponse.json(page);
  } catch {
    return persistenceUnavailableResponse();
  }
}

export async function POST(req: NextRequest) {
  let acc;
  try { acc = await authenticate(req); } catch { return persistenceUnavailableResponse(); }
  if (!acc) {
    return NextResponse.json({ error: hasKeyHeader(req) ? 'invalid_api_key' : 'api_key_required' }, { status: 401 });
  }
  const rl = rateLimit('suppression:post:' + clientIp(req), 120);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rawPhones = Array.isArray(body.phones) ? body.phones : typeof body.phone === 'string' ? [body.phone] : [];
  if (!rawPhones.length) {
    return NextResponse.json({ error: 'phones_required' }, { status: 400 });
  }
  if (rawPhones.length > MAX_BULK_PHONES) {
    return NextResponse.json({ error: 'too_many_phones', max: MAX_BULK_PHONES }, { status: 413 });
  }

  const rawReason = typeof body.reason === 'string' ? body.reason : 'manual';
  const reason: SuppressionReason = (SUPPRESSION_REASONS as readonly string[]).includes(rawReason)
    ? (rawReason as SuppressionReason)
    : 'manual';
  const requestedAt = typeof body.requested_at === 'string' ? new Date(body.requested_at) : undefined;
  const ownerKey = ownerKeyFor(acc);

  let added = 0;
  let alreadySuppressed = 0;
  let invalid = 0;
  const results: Array<{ phone_masked?: string; added?: boolean; already_suppressed?: boolean; evidence_id?: string; error?: string }> = [];

  try {
    for (const p of rawPhones) {
      if (typeof p !== 'string') {
        invalid += 1;
        results.push({ error: 'invalid_phone' });
        continue;
      }
      try {
        const res = await addSuppression({
          ownerKey,
          phone: p,
          reason,
          source: 'api',
          requestedAt,
        });
        if (res.added) added += 1;
        else alreadySuppressed += 1;
        results.push({
          phone_masked: res.entry.phoneMasked,
          added: res.added,
          already_suppressed: res.already_suppressed,
          evidence_id: res.evidence_id,
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'invalid_phone') {
          invalid += 1;
          results.push({ error: 'invalid_phone' });
        } else {
          throw e;
        }
      }
    }
    return NextResponse.json({ added, already_suppressed: alreadySuppressed, invalid, results }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'credentials_key_missing') {
      return NextResponse.json({ error: 'credentials_key_missing' }, { status: 503 });
    }
    return persistenceUnavailableResponse();
  }
}

export async function DELETE(req: NextRequest) {
  let acc;
  try { acc = await authenticate(req); } catch { return persistenceUnavailableResponse(); }
  if (!acc) {
    return NextResponse.json({ error: hasKeyHeader(req) ? 'invalid_api_key' : 'api_key_required' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const phone = typeof body.phone === 'string' ? body.phone : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!phone) return NextResponse.json({ error: 'phone_required' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'reason_required' }, { status: 400 });

  try {
    const res = await removeSuppression({ ownerKey: ownerKeyFor(acc), phone, reason });
    if (res.not_found) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, removed: true, evidence_id: res.evidence_id });
  } catch (err) {
    if (err instanceof Error && err.message === 'invalid_phone') {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }
    return persistenceUnavailableResponse();
  }
}
