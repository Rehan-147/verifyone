# n8n / Make / Zapier × VerifyOne Pre-Dial Gate

No-code automation: drop the gate between your lead source and your dialer/emailer.

## n8n — HTTP Request node

1. **Trigger**: your lead source (webhook, CRM watch, Google Sheets row)
2. **HTTP Request node**:
   - Method: `POST`
   - URL: `https://app.verifyone.io/api/v1/gate/phone`
   - Body (JSON):
   ```json
   {
     "phone": "{{ $json.phone }}",
     "channel": "voice",
     "consent": { "declared": {{ $json.consent_on_file }}, "type": "express_written" }
   }
   ```
3. **IF node**: `{{ $json.decision }}` equals `allow` → dialer branch; else → skip/branch
   (write `reason` + `evidence_id` back to your sheet/CRM)
4. Add a second gate branch for email with `POST /api/v1/gate/email` →
   decision `send` | `hold` | `block` before Instantly/Smartlead.

## Make (Integromat)

- Module: **HTTP → Make a request**
- URL `https://app.verifyone.io/api/v1/gate/phone`, method POST, JSON body same as above
- Router: filter `decision = allow` → Vapi/Retell/Twilio module; fallback → audit log row

## Zapier

1. **Webhooks by Zapier** → POST to `https://app.verifyone.io/api/v1/gate/phone`
   with payload `{"phone": "{{phone}}", "channel": "voice"}` (Beancon: include header
   `Content-Type: application/json`)
2. **Filter by Zapier** → only continue if `Decision` = `allow`
3. **Action** → your dialer/SMS/CRM step; map `Evidence ID` into a notes field

## Free tier

500 gate checks/month per IP, no account needed to start testing. Add an API key
header once you pass that.
