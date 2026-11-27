export const dynamic = 'force-dynamic';

// POST /api/webhooks/dodo — signature-verified (Standard Webhooks scheme).
// Processing is exactly-once per delivery and per payment (see lib/billing.ts):
// credits go to the paying organization (metadata.org_id or the linked subscription),
// legacy accounts by email; payments that cannot be attributed yet are parked as unresolved.
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '../../../../lib/dodo';
import { processDodoEvent } from '../../../../lib/billing';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const webhookId = req.headers.get('webhook-id');
  const verdict = verifyWebhook(raw, {
    'webhook-id': webhookId,
    'webhook-signature': req.headers.get('webhook-signature'),
    'webhook-timestamp': req.headers.get('webhook-timestamp'),
  });
  if (!verdict.ok || !webhookId) {
    return NextResponse.json({ error: 'invalid_signature', reason: verdict.reason }, { status: 401 });
  }

  let evt: Record<string, unknown>;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  try {
    const result = await processDodoEvent(webhookId, evt);
    // Duplicates are acknowledged with 200 so Dodo stops retrying.
    return NextResponse.json({ received: true, type: evt.type, ...result });
  } catch (error) {
    console.error('[dodo-webhook] processing failed', error instanceof Error ? error.message : error);
    // Non-2xx makes Dodo retry; nothing was committed for this delivery.
    return NextResponse.json({ error: 'processing_failed' }, { status: 503 });
  }
}
