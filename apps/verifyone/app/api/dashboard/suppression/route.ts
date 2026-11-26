export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkConfigured } from '@/lib/clerk';
import { dbEnabled } from '@/lib/db';
import { getOrCreateOrganization } from '@/lib/orgs';
import { findColumn, parseCsvInput } from '@/lib/bulk-input';
import {
  addSuppression,
  listSuppression,
  removeSuppression,
  SUPPRESSION_REASONS,
  type SuppressionReason,
} from '@/lib/suppression';

export const runtime = 'nodejs';

const PHONE_COLUMNS = ['phone', 'phone_number', 'mobile', 'number', 'to', 'to_number', 'cell'];

export async function GET(req: NextRequest) {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const { userId, orgId, orgSlug } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  if (org.disabledAt) return NextResponse.json({ error: 'org_disabled' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const search = searchParams.get('search');
  const page = await listSuppression({ ownerKey: `org:${org.id}`, cursor, searchPhone: search });
  return NextResponse.json(page);
}

export async function POST(req: NextRequest) {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const { userId, orgId, orgSlug } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  if (org.disabledAt) return NextResponse.json({ error: 'org_disabled' }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rawReason = typeof body.reason === 'string' ? body.reason : (typeof body.csv === 'string' ? 'import' : 'manual');
  const reason: SuppressionReason = (SUPPRESSION_REASONS as readonly string[]).includes(rawReason)
    ? (rawReason as SuppressionReason)
    : 'manual';
  const ownerKey = `org:${org.id}`;

  let phones: string[] = [];
  let source: 'dashboard' | 'csv_import' = 'dashboard';
  if (typeof body.csv === 'string' && body.csv.trim()) {
    source = 'csv_import';
    const parsed = parseCsvInput(body.csv);
    const phoneCol = findColumn(parsed.headers, PHONE_COLUMNS);
    if (!phoneCol) {
      return NextResponse.json({ error: 'phone_column_not_found', headers: parsed.headers }, { status: 400 });
    }
    phones = parsed.records.map((r) => String(r[phoneCol] ?? '').trim()).filter(Boolean);
  } else if (typeof body.phone === 'string' && body.phone.trim()) {
    phones = [body.phone.trim()];
  } else {
    return NextResponse.json({ error: 'phone_or_csv_required' }, { status: 400 });
  }

  let added = 0;
  let alreadySuppressed = 0;
  let invalid = 0;
  for (const p of phones) {
    try {
      const res = await addSuppression({ ownerKey, phone: p, reason, source, createdBy: userId });
      if (res.added) added += 1;
      else alreadySuppressed += 1;
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'invalid_phone') invalid += 1;
      else throw e;
    }
  }
  return NextResponse.json({ added, already_suppressed: alreadySuppressed, invalid }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!clerkConfigured()) return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
  if (!dbEnabled()) return NextResponse.json({ error: 'persistence_unavailable' }, { status: 503 });

  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 });
  if (orgRole !== 'org:admin') return NextResponse.json({ error: 'admin_required' }, { status: 403 });

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  if (org.disabledAt) return NextResponse.json({ error: 'org_disabled' }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const phone = typeof body.phone === 'string' ? body.phone : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!phone) return NextResponse.json({ error: 'phone_required' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'reason_required' }, { status: 400 });

  const res = await removeSuppression({ ownerKey: `org:${org.id}`, phone, reason, removedBy: userId });
  if (res.not_found) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, evidence_id: res.evidence_id });
}
