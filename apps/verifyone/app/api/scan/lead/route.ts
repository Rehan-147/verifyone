export const dynamic = 'force-dynamic';

// POST /api/scan/lead { email, scan_id?, consent_to_contact: true }
// Stores a contact request after a free scan. Nothing is stored without explicit consent.
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/auth';
import { saveScanLead, ScanError } from '@/lib/scan';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit('scan-lead:' + ip, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => null) as { email?: unknown; scan_id?: unknown; consent_to_contact?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  try {
    const lead = await saveScanLead({
      email: typeof body.email === 'string' ? body.email : '',
      scanId: typeof body.scan_id === 'string' ? body.scan_id : null,
      consentToContact: body.consent_to_contact === true,
      ip,
    });
    return NextResponse.json({ ok: true, lead_id: lead.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ScanError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
