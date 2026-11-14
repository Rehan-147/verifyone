# GoHighLevel — VerifyOne pre-dial gate in agency workflows

GHL is where home-services lead-gen agencies (our BuyerPath #2) actually run
outreach. Two integration levels, today and tomorrow:

## Level 1 — Custom Webhook Action (works today, no listing required)

Drop this into any GHL workflow **before** the AI voice dial step
(Vapi / Retell / Bland block inside the workflow).

1. Workflow → **Add Action → Custom Webhook** (or "Webhook" action)
2. Method: `POST`, URL:

```
https://app.verifyone.io/api/v1/gate/phone
```

3. Headers:

```
Authorization: Bearer {{ verifyone_api_key }}   # stored in agency settings / snapshot
Content-Type: application/json
```

4. Body (map GHL contact fields):

```json
{
  "phone": "{{contact.phone}}",
  "channel": "ai_voice",
  "campaign_type": "sales",
  "consent": {
    "declared": {{contact.voice_consent_declared}},
    "type": "{{contact.voice_consent_type}}",
    "trustedform_cert_url": "{{contact.trustedform_cert_url}}"
  }
}
```

5. Follow-up actions on the response:

| Field | Meaning | Suggested workflow branch |
|---|---|---|
| `decision = "ALLOW"` | dial | → AI dialer action |
| `decision = "REVIEW"` | human decides | → notify + task "Confirm consent" |
| `decision = "DENY"` | never dial | → `set contact tag: verifyone_blocked <reason>` + log `evidence_id` to a note (client-compliance proof) |

Optional second step (after the call): **Custom Webhook → outcome ledger**

```
POST https://app.verifyone.io/api/v1/gate/outcome
{ "phone": "{{contact.phone}}", "evidence_id": "<gate evidence id>",
  "outcome": "booked" | "not_interested" | "opt_out" | ... }
```

Do-not-call/opt-out answers feed internal suppression for future dial attempts.

## Level 2 — GHL Marketplace app (pending)

- Draft listing copy exists conceptually; app needs OAuth/agency token plumbing.
- Ask: a "VerifyOne" agency app that (a) verifies consent property per contact,
  (b) exposes a native "Pre-Dial Gate" workflow action, (c) writes
  `verifyone_status / reason / evidence_id` properties like the HubSpot path.

## The agency sales line

"When a client asks 'why did your AI call this person?', your workflow exports a
`verifyone_status / reason / evidence_id` per contact — the compliance answer is
in the CRM, not in a screenshot."
