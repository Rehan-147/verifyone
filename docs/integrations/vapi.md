# Vapi × VerifyOne Pre-Dial Gate

Point Vapi’s **Server URL** (or a function tool that runs before `POST /v1/calls`) at:

```
POST https://YOUR_DOMAIN/api/webhooks/vapi
Content-Type: application/json
```

## Payload

VerifyOne extracts the callee from common Vapi shapes:

```json
{
  "call": {
    "customer": { "number": "+14155552120" }
  },
  "consent": { "declared": false, "type": "none" },
  "profile": "ai_outbound_shield"
}
```

## Response

On **DENY**, the body includes platform hints so you can abort before trunk connect:

```json
{
  "decision": "DENY",
  "reason": "LITIGATOR_TRAP",
  "evidence_id": "ev_...",
  "abort_call": true,
  "vapi": { "action": "endCall", "endCall": true }
}
```

On **ALLOW**, continue the call flow and persist `evidence_id` in your CRM.

## Latency

Default `ai_outbound_shield` uses local DNC + litigator caches (no live HLR). Target &lt;100ms for voice webhooks.
