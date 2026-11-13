// POST /api/webhooks/hubspot — HubSpot contact webhooks -> Pre-Dial Gate -> property write-back.
//
// HubSpot delivers an array of subscription events containing only an objectId, so the route
// verifies the v3 signature, reads the contact's phone from the HubSpot CRM API, and hands the
// pair to handleHubSpotWebhook (which runs the gate in-process and PATCHes the verdict back).
//
// AuthN is the signature, not a caller key: HubSpot cannot send our Authorization header. An
// optional x-api-key / ?key= is accepted purely to attribute the sealed evidence to an account.
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyHubSpotSignature,
  fetchHubSpotContact,
  handleHubSpotWebhook,
  type HubSpotWebhookEvent,
} from '../../../../lib/integrations/hubspot';
import { rateLimit, clientIp } from '../../../../lib/auth';

export const runtime = 'nodejs';

// HubSpot batches events per delivery; each one costs a gate run and a PATCH.
const MAX_EVENTS_PER_DELIVERY = 10;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit('webhook:hubspot:' + ip, 120);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });
  }

  // Signed bytes, read once: parse from this string rather than req.json().
  const raw = await req.text();

  const verdict = verifyHubSpotSignature({
    rawBody: raw,
    requestUrl: new URL(req.url),
    headers: req.headers,
    method: req.method,
    signature: req.headers.get('x-hubspot-signature-v3'),
    timestamp: req.headers.get('x-hubspot-request-timestamp'),
  });
  if (!verdict.ok) {
    return NextResponse.json({ error: 'invalid_signature', reason: verdict.reason }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const events: HubSpotWebhookEvent[] = (Array.isArray(parsed) ? parsed : [parsed]).filter(
    (e) => typeof e?.subscriptionType === 'string' && e.subscriptionType.startsWith('contact.') && e.objectId != null
  );

  if (!events.length) {
    // 200 on purpose: a non-contact subscription is a permanent "nothing to do", and a 4xx
    // would make HubSpot redeliver it until the subscription is marked failing.
    return NextResponse.json({ received: true, ignored: true, reason: 'no_contact_events' });
  }

  const apiKey =
    req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key') || '';

  const results: Record<string, unknown>[] = [];
  for (const event of events.slice(0, MAX_EVENTS_PER_DELIVERY)) {
    const contactId = String(event.objectId);
    const consentProperty = process.env.HUBSPOT_CONSENT_PROPERTY || '';

    const contact = await fetchHubSpotContact(contactId, consentProperty ? [consentProperty] : []);
    if ('error' in contact) {
      results.push({
        contactId,
        subscriptionType: event.subscriptionType,
        error: contact.error,
        status: contact.status,
        transient: contact.transient === true,
      });
      continue;
    }

    // Consent is never inferred from "this contact exists". Without HUBSPOT_CONSENT_PROPERTY
    // the gate sees no consent on file and denies AI-voice dialing, which is the fail-closed
    // answer rather than a bug.
    const token = (consentProperty ? String(contact.properties[consentProperty] ?? '') : '').toLowerCase();
    const known = token === 'express_written' || token === 'ebr';
    const consent = known
      ? { declared: true, type: token as 'express_written' | 'ebr' }
      : { declared: false, type: 'none' as const };

    const outcome = await handleHubSpotWebhook(
      {
        contactId,
        phone: contact.properties.phone,
        email: contact.properties.email,
        channel: 'voice',
        consent,
      },
      apiKey || `hubspot-webhook:${contactId}`
    );

    results.push({ contactId, subscriptionType: event.subscriptionType, ...outcome });
  }

  // Redeliver only when every event failed on a transient HubSpot problem; a 4xx would otherwise
  // make HubSpot hammer a permanently unresolvable contact until the subscription flips to failing.
  const retryable = results.length > 0 && results.every((r) => r.error && r.transient);

  return NextResponse.json(
    {
      received: true,
      delivered: events.length,
      processed: results.length,
      results,
    },
    { status: retryable ? 502 : 200 }
  );
}
