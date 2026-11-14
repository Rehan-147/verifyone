# Integrations — how the 100 are wired

Count: see `lib/integrations/catalog-100.ts` (the array is the source of truth; `GET /api/integrations/{slug}`
404s any slug that is not in it).

Files:
- `lib/integrations/catalog-100.ts` — all catalog definitions (slug, category, method, fields)
- `lib/integrations/adapter.ts` — field-name normalizer that decides phone vs email gate
- `app/api/integrations/[provider]/route.ts` — the dynamic route, registered and built
- `lib/integrations/google-sheets.js` — Apps Script formula, paste into a sheet
- `supabase/seed-100.sql` — Seed

## One endpoint for every tool

```
POST /api/integrations/{slug}
x-api-key: vk_live_...       (or Authorization: Bearer vk_live_...)
Content-Type: application/json

{ "phone_number": "+14155552120", "consent_type": "express_written" }
```

The adapter flattens CRM-style nesting (`input.data`, `contact`, HubSpot `properties:{name:{value}}`,
Zapier line items `[{key|property, value}]`) and matches
`phone`, `phone_number`, `PhoneNumber`, `msisdn`, `mobile`, `mobile_number` for the phone
gate and `email`, `email_address`, `user_email` for the email gate — case-insensitively, quoted or
unquoted numbers both accepted. Phone wins if both are present.

`{slug}` is a label for attribution and routing only — there is no per-tool code. Point a HubSpot
webhook, a Zapier HTTP step, a Make module and an n8n node at the same body with different slugs.

## What it does NOT do

It does not call `/api/v1/validate` (that endpoint does not exist) and it does not make an HTTP
request to its own `APP_URL` — a serverless function cannot reliably reach itself, and a second
copy of the decision logic would drift from `lib/gate.ts`. The route forwards the live request
**in-process** into `app/api/v1/gate/phone/route.ts` or `app/api/v1/gate/email/route.ts`, so auth,
credit metering, the free-tier quota, rate limits and evidence sealing happen exactly once.

## Response

The gate payload is returned verbatim with the provider envelope added, and the gate's HTTP status
is preserved:

```json
{
  "provider": "hubspot",
  "gate": "phone",
  "matched": { "phone": "+14155552120" },
  "decision": "ALLOW",
  "reason": "PASS",
  "evidence_id": "ev_…",
  "decision_legacy": "allow",
  "reason_legacy": "cleared",
  "checks": { "…": "…" },
  "risk_score": 10,
  "plan": "FREE",
  "usage": { "used": 1, "limit": 500 }
}
```

`GET /api/integrations/{slug}` returns the catalog entry plus its endpoint path.

Errors: `404 integration_not_found`, `400 invalid_json_body`, `400 no_gateable_field`,
`429 rate_limited` / `quota_exceeded` (both passed through from the gate).

## Google Sheets

`=VERIFYONE(value, type?, consent?)` — see the header comment in
`lib/integrations/google-sheets.js` for the `VERIFYONE_URL` / `VERIFYONE_KEY` Script Properties it
requires. It calls the gate endpoints directly, not the integrations route.

## Zapier / Make / n8n

HTTP request step → `POST /api/integrations/{slug}`, `x-api-key` header, pass the trigger object
through as the body. There is no published Zapier app; the generic HTTP step is the integration.

## HubSpot has a second, dedicated path

`POST /api/webhooks/hubspot` is for HubSpot's own contact subscriptions: it verifies
`x-hubspot-signature-v3`, fetches the contact's phone from the CRM API, runs the gate and PATCHes
`verifyone_status` / `verifyone_reason` / `verifyone_evidence_id` back onto the contact.
`POST /api/integrations/hubspot` remains the generic forwarder — it gates and returns the verdict
but writes nothing back. See [docs/DEPLOY.md](docs/DEPLOY.md) for the three `HUBSPOT_*` keys and the
custom properties that must exist first. The webhook path is **not metered** (no credits deducted).

## Not wired (do not claim otherwise)

- **No per-provider code.** `_1`/`_2` copies under `lib/integrations/` and `app/api/mcp/route_1.ts`
  are stale duplicates that still reference the nonexistent `/api/v1/validate`. Nothing imports
  them; they are not compiled into the build. Delete or reconcile them before publishing docs
  derived from them.
- **`lib/integrations/zapier-make-n8n.ts`** still defines its Zapier/N8N/Make payloads against the
  raw `/api/v1/validate_phone` validator rather than the gate, and no route imports it. Nothing
  publishes it — treat it as a template, not as an installed integration.
