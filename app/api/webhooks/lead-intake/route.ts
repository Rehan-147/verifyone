// LEAD-INTAKE CONSENT CAPTURE — closes the front half of the consent loop.
//
// Marketing dials start at the FORM, not at the dialer. This endpoint is the
// platform-neutral intake any form/CRM tooling can POST to (GoHighLevel webhook
// action, JotForm generic webhook, n8n / Zapier from Google Lead Forms, LinkedIn
// Lead Gen, WhatsApp lead ads). It seals a consent-claim evidence record into the
// same hash-chained ledger the gate uses, so the story for a lead reads:
//
//   form submission (consent claimed, ev_…) → gate decision (ev_…) → call outcome (ev_…)
//
// It is NOT a lead router and NOT an official partnership with any platform —
// the caller's tooling makes the POST under its own auth relationship. Payload
// mapping table lives at docs/integrations/lead-intake-webhooks.md. Platform-named
// webhook routes were intentionally not created: one contract beats five guesses.
//
//   POST /api/webhooks/lead-intake
//   { phone?* | email?*, platform?, consent?: { declared, type?, trustedform_cert_url? },
//     form_url?, campaign?, notes? }      (* at least one of phone/email)
//   -> 201 { decision: "consent_recorded", evidence_id, platform, persistence, audit }
import { NextRequest, NextResponse } from 'next/server';
import { sealEvidence, normalizePhone, maskPhone, checkAndBumpQuota } from '@/lib/audit-store';
import { authenticate, meter, rateLimit } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Same payload shapes the gate webhooks accept, plus common form-tool keys.
function extractLeadPhone(body: Record<string, unknown>): string {
  const candidates: unknown[] = [
    body.phone,
    body.phone_number,
    body.customer_phone,
    body.to,
    body.from_number,
    (body.lead as Record<string, unknown> | undefined)?.phone,
    (body.customer as Record<string, unknown> | undefined)?.phone,
    (body.contact as Record<string, unknown> | undefined)?.phone,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.replace(/\D/g, '').length >= 7) return c;
  }
  return '';
}

function extractLeadEmail(body: Record<string, unknown>): string {
  const candidates: unknown[] = [
    body.email,
    body.email_address,
    (body.lead as Record<string, unknown> | undefined)?.email,
    (body.customer as Record<string, unknown> | undefined)?.email,
    (body.contact as Record<string, unknown> | undefined)?.email,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.trim())) return c.trim();
  }
  return '';
}

function extractConsentClaim(body: Record<string, unknown>): {
  declared: boolean;
  type: 'none' | 'express_written' | 'ebr';
  trustedform_cert_url?: string;
} {
  const c = (body.consent || (body.lead as Record<string, unknown> | undefined)?.consent) as
    | { declared?: boolean; type?: string; trustedform_cert_url?: string }
    | undefined;
  const certUrl =
    (c && typeof c.trustedform_cert_url === 'string' && c.trustedform_cert_url) ||
    (typeof body.trustedform_cert_url === 'string' && body.trustedform_cert_url) ||
    '';
  const type = c?.type === 'express_written' || c?.type === 'ebr' ? c.type : certUrl ? 'express_written' : 'none';
  return {
    declared: !!(c?.declared || c?.type || certUrl),
    type,
    ...(certUrl ? { trustedform_cert_url: certUrl } : {}),
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = rateLimit('lead-intake:' + ip, 120);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429, headers: CORS });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: CORS });
  }

  const phoneRaw = extractLeadPhone(body);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : '';
  const email = extractLeadEmail(body);
  if (!phone && !email) {
    return NextResponse.json(
      {
        error: 'phone_or_email_required',
        hint: 'Send { "phone": "+14155550123", "consent": {...} } or { "email": "lead@example.com", ... }',
      },
      { status: 400, headers: CORS },
    );
  }

  const consent = extractConsentClaim(body);
  const platform =
    (typeof body.platform === 'string' && body.platform.slice(0, 40)) ||
    (typeof body.source === 'string' && body.source.slice(0, 40)) ||
    'unsourced';

  const acc = await authenticate(req);
  if (acc && !acc.credits) {
    return NextResponse.json(
      { error: 'insufficient_credits', reup: '/pricing' },
      { status: 402, headers: CORS },
    );
  }

  const callerKey = acc?.email || 'lead-intake:' + ip;
  if (acc) {
    await meter(acc, 1);
  } else {
    const quota = await checkAndBumpQuota(callerKey);
    if (!quota.allowed) {
      return NextResponse.json({ error: 'quota_exceeded', used: quota.used, limit: quota.monthly_limit }, { status: 429, headers: CORS });
    }
  }

  const { evidence, persistence } = await sealEvidence({
    phone: phone || email, // intake channel: one lead identifier is required
    channel: 'lead_intake',
    consent,
    decision: 'consent_recorded',
    reason: `consent_claimed_${platform}`,
    checks: {
      platform,
      phone_masked: phone ? maskPhone(phone) : undefined,
      phone_hash: phone || undefined,
      email_masked: email ? email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined,
      consent_claim: consent,
      form_url: typeof body.form_url === 'string' ? body.form_url.slice(0, 300) : undefined,
      campaign: typeof body.campaign === 'string' ? body.campaign.slice(0, 80) : undefined,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 300) : undefined,
    },
    callerKey,
  });

  return NextResponse.json(
    {
      decision: 'consent_recorded',
      reason: `consent_claimed_${platform}`,
      evidence_id: evidence.evidence_id,
      platform,
      phone_masked: phone ? maskPhone(phone) : undefined,
      email_masked: email ? email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined,
      consent,
      persistence,
      next_step:
        'On dial time, pass this consent claim to the gate (api/v1/gate/phone) and link evidence_id via the outcome endpoint for the full per-lead story.',
      audit: {
        chain: 'sha256-hash-chained',
        verify_url: `/api/v1/gate/audit/${evidence.evidence_id}`,
        export_url: `/api/v1/gate/audit/${evidence.evidence_id}/export?format=html`,
      },
    },
    { status: 201, headers: CORS },
  );
}
