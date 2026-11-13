# Clay × VerifyOne Pre-Dial Gate

Verify every phone/email in your Clay table before your AI dialer or sender touches it —
directly in a Clay column, no code.

## Setup (2 minutes)

1. In your Clay table: **Add Column → HTTP API**
2. **Method:** `POST`
3. **URL:** `https://app.verifyone.io/api/clay/enrich` (localhost dev: `http://localhost:3000/api/clay/enrich`)
4. **Headers:** `Content-Type: application/json` (optional `Authorization: Bearer vk_live_...`)
5. **Body (JSON):**
   ```json
   {
     "phone": "{{Phone Number}}",
     "email": "{{Email}}",
     "consent": { "declared": true, "type": "express_written" }
   }
   ```
   (map `{{...}}` to your actual column names; drop consent if you have none — the gate will
   correctly block AI-voice dialing without it)
6. **Response mapping** — the endpoint returns flat fields, map the ones you want:

| Field | Meaning |
|---|---|
| `vt_gate` | `allow` / `block` — dial only on allow |
| `vt_reason` | `cleared`, `quiet_hours`, `do_not_call_no_consent`, `ai_voice_consent_required`, `litigator_list`, `reassigned_number_consent_required`, `disconnected`, `invalid_number` |
| `vt_line_type` | mobile / landline / voip |
| `vt_carrier` | carrier name |
| `vt_dnc` / `vt_litigator` | true when on a list |
| `vt_calling_hours_ok` | is it a legal hour in the contact's timezone right now |
| `vt_caller_tz` | e.g. `America/Chicago` — use for send-time columns |
| `vt_email_gate` | `send` / `hold` / `block` |
| `vt_evidence_id` | sealed audit record for this row (compliance proof) |
| `vt_verified_at` | freshness timestamp |

7. Optional **Formula column**: only dial rows where `vt_gate = "allow"`.

## Cost

- 2 credits per gated phone row, 1 credit per email row
- Free: 500 gate checks/month keyless, or sign up (`POST /api/auth/signup`) for 1,000 credits
- Every response is cached 24h — re-running the column doesn't double-charge

## Why

- FCC-24-17: an AI voice is an "artificial voice" under the TCPA — wireless numbers need prior
  express **written** consent. Vapi/Retell/Bland do not check this for you.
- VerifyOne checks DNC, litigator lists, reassigned numbers, disconnected status and calling
  hours in one call and returns a sealed audit record for every row.
