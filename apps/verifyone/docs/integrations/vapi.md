## Outbound: gate-then-dial

Vapi's outbound `POST /call` starts dialing directly. Call VerifyOne first from your
own scheduler or workflow, then create the Vapi call only when the gate returns
`ALLOW`. Any other decision stops the workflow. Dial-through, where VerifyOne
places the call for you, is coming soon.

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

await fetch('https://api.vapi.ai/call', {
  method: 'POST',
  headers: { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    assistantId: VAPI_ASSISTANT_ID,
    phoneNumberId: VAPI_PHONE_NUMBER_ID,
    customer: { number: lead.phone },
  }),
});
// Store gate.evidence_id with your own call record.
```

## Outbound: dial-through

The dial-through API stores your Vapi key encrypted and places a call only after a live
VerifyOne gate returns `ALLOW`. Configure the platform credential with your VerifyOne API key:

```http
PUT /api/v1/platforms/vapi/credentials
Authorization: Bearer VERIFYONE_API_KEY
Content-Type: application/json

{"api_key":"VAPI_CUSTOMER_API_KEY","defaults":{"assistant_id":"asst_...","phone_number_id":"pn_..."}}
```

Then submit each outbound attempt with a unique idempotency key:

```http
POST /api/v1/dial/vapi
Authorization: Bearer VERIFYONE_API_KEY
Idempotency-Key: campaign-42-lead-123-attempt-1
Content-Type: application/json

{"phone":"+14155550123","consent":{"declared":true,"type":"express_written"}}
```

The response includes the gate evidence ID; an allowed call also returns the platform call ID.
Repeated requests with the same key and body replay the saved result without placing another call.

## Inbound screening (beta)

Configure `/api/webhooks/vapi?assistant_id=YOUR_ASSISTANT_ID` as the server URL for
inbound `assistant-request` messages. VerifyOne screens the caller from
`message.call.customer.number` (falling back to `message.customer.number`). It
rejects invalid numbers and flags matches in the loaded litigator list. A
per-account customer block-list lookup is not wired yet. It does not apply
outbound DNC/consent rules. An allowed request returns `{"assistantId":"..."}`; a blocked or inconclusive
request returns `{"error":"This call cannot be connected."}`. The decision,
reason, and evidence ID are available in `x-verifyone-*` response headers. This
inbound beta does not gate Vapi outbound calls.
