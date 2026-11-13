# Lead-intake consent capture — one webhook, any form tool

Every lead that will ever be dialed starts at a form. VerifyOne records the
**consent claim at intake** so the per-lead evidence chain reads:

```
form submission  →  gate decision  →  call outcome
ev_... (consent_recorded)   ev_... (ALLOW/REVIEW/DENY)   ev_... (booked/opt_out)
```

**Endpoint:** `POST /api/webhooks/lead-intake`

> Honest framing: VerifyOne has NO official partnerships with the platforms below.
> The mapping is done in YOUR tooling (webhook action / Zapier / n8n). Platform-
> named routes on VerifyOne were deliberately not created — one documented contract
> beats five undocumentable guesses.

## Contract

```json
{
  "phone": "+14155550123",            // OR "email": "lead@example.com" (at least one required)
  "platform": "ghl",                  // free tag: ghl | jotform | google_lead_forms | linkedin_lead_gen | whatsapp | ...
  "consent": {
    "declared": true,
    "type": "express_written",
    "trustedform_cert_url": "https://cert.trustedform.com/..."   // optional
  },
  "form_url": "https://client-roofing.com/quote",
  "campaign": "roof-replacement-q1",
  "notes": "optional free text, truncated to 300 chars"
}
```

Response `201`:

```json
{
  "decision": "consent_recorded",
  "reason": "consent_claimed_ghl",
  "evidence_id": "ev_...",
  "platform": "ghl",
  "phone_masked": "+1********0123",
  "persistence": "file",
  "audit": { "chain": "sha256-hash-chained", "verify_url": "/api/v1/gate/audit/ev_..." }
}
```

Errors: `400 phone_or_email_required` · `402 insufficient_credits` (empty paid
account) · `429 rate_limited` / `quota_exceeded` (anonymous free tier).

## Per-platform mapping (no payload guesswork — map these fields)

| Source | How the POST gets made | phone | consent type | trustedform cert |
|---|---|---|---|---|
| **GoHighLevel** | Workflow → **Custom Webhook Action** on form-submitted/pipeline-entered | `{{contact.phone}}` | `{{contact.voice_consent_type}}` | `{{contact.trustedform_cert_url}}` |
| **JotForm** | JotForm → **Generic Webhook** (POSTs form JSON) or Zapier | answer alias for "Phone" or `{{phone}}` | consent checkbox → `express_written` if ticked | Jotform **TrustedForm app** hook or cert field |
| **Google Lead Forms** | Zapier / n8n "New Lead" trigger → Webhook step | `{{Phone}}` | lead-form consent checkbox copy → `express_written` | unavailable (no cert — record claim without one) |
| **LinkedIn Lead Gen** | Zapier / n8n trigger → Webhook step | `{{Phone Numbers}}` | The lead-form consent question copy → `express_written` | unavailable |
| **WhatsApp lead ads / click-to-WhatsApp** | Zapier / n8n (Meta lead or WA conversation-start) | `{{Phone}}` | WhatsApp template opt-in = **ebr** (existing relationship consent) — map honestly | unavailable |
| **Anything else** | Any POST with at least phone or email | `phone` | `consent.type` | — |

Field nesting tolerated by the extractor (same as the gate webhooks):
`phone` · `phone_number` · `customer_phone` · `to` · `lead.phone` ·
`customer.phone` · `contact.phone` (and the `email` equivalents).

## Field honesty notes (say these on sales calls)

- Google/LinkedIn/WhatsApp leads come **without TrustedForm certificates** — the
  intake seals the *claim* (checkbox copy, form URL, timestamp) and the absence of
  a cert is visible in the evidence; that is the state of those platforms.
- WhatsApp template opt-in is mapped to `consent.type: "ebr"` by convention
  (existing-relationship consent), not express written. Do not overclaim it.
- The gate at dial time still takes the CONSENT FROM THE CALLER. Intake links via
  the evidence chain (`evidence_id`), so keep the intake record id with the lead.

## Wire it with the dial-time gate (full story)

1. Intake: this webhook → `ev_intake` stored with the lead in your CRM.
2. Dial time: gate with the same consent claim → `ev_gate`.
3. After the call: outcome with both ids → `ev_outcome`.

```bash
# intake
curl -s -X POST https://app.verifyone.io/api/webhooks/lead-intake \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","platform":"ghl","consent":{"declared":true,"type":"express_written"},"form_url":"https://client-roofing.com/quote"}'

# hand-off view of the intake record
open https://app.verifyone.io/api/v1/gate/audit/ev_.../export?format=html
```
