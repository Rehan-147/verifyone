## Outbound: gate-then-dial

Retell's `create-phone-call` endpoint starts dialing directly. Call VerifyOne from
your scheduler or workflow first; create the Retell call only when the gate returns
`ALLOW`. For `DENY`, `REVIEW`, or an unavailable result, stop and save the evidence
ID. Dial-through, where VerifyOne places the call for you, is coming soon.

```javascript
const gate = await fetch('https://YOUR_DOMAIN/api/v1/gate/phone', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${VERIFYONE_API_KEY}`,
  },
  body: JSON.stringify({ phone: lead.phone, channel: 'voice', consent: lead.consent }),
}).then((response) => response.json());

if (gate.decision !== 'ALLOW') {
  await saveSkippedLead({ phone: lead.phone, reason: gate.reason, evidence_id: gate.evidence_id });
  return;
}

await fetch('https://api.retellai.com/v2/create-phone-call', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from_number: RETELL_FROM_NUMBER,
    to_number: lead.phone,
  }),
});
// Store gate.evidence_id with your own call record.
```

## Outbound: dial-through

The dial-through API stores your Retell key encrypted and creates a call only after a live
VerifyOne gate returns `ALLOW`. Configure your platform credential with your VerifyOne API key:

```http
PUT /api/v1/platforms/retell/credentials
Authorization: Bearer VERIFYONE_API_KEY
Content-Type: application/json

{"api_key":"RETELL_CUSTOMER_API_KEY","defaults":{"agent_id":"agent_...","from_number":"+14155550100"}}
```

Then submit each attempt with a unique idempotency key:

```http
POST /api/v1/dial/retell
Authorization: Bearer VERIFYONE_API_KEY
Idempotency-Key: campaign-42-lead-123-attempt-1
Content-Type: application/json

{"phone":"+14155550123","consent":{"declared":true,"type":"express_written"}}
```

The response includes the gate evidence ID; an allowed call also returns the Retell call ID.
Repeated requests with the same key and body replay the saved result without placing another call.

## Inbound screening (beta)

Configure `POST /api/webhooks/retell` as the phone number's inbound call webhook.
VerifyOne screens `call_inbound.from_number`: it rejects invalid numbers and
flags matches in the loaded litigator list. A per-account customer block-list
lookup is not wired yet. It does not apply outbound DNC/consent rules. An allowed call returns
`call_inbound.metadata` with `verifyone_evidence_id` and
`verifyone_decision: "ALLOW"`; a blocked or inconclusive call returns
`call_inbound.reject: true`. Decision, reason, and evidence ID are available in
`x-verifyone-*` response headers. This inbound beta does not gate Retell outbound
dials. Litigator hits (`LITIGATOR_TRAP`) are evaluated before DNC violations in
the gate ladder.
