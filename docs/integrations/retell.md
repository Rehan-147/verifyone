# Retell × VerifyOne Pre-Dial Gate

Register VerifyOne as a **pre-call webhook** before Retell connects the outbound leg:

```
POST https://YOUR_DOMAIN/api/webhooks/retell
Content-Type: application/json
```

## Payload

```json
{
  "to_number": "+14155552120",
  "consent": { "declared": true, "type": "express_written" },
  "profile": "ai_outbound_shield"
}
```

## Response

When `decision` is `DENY`, use the `retell` block to hang up / ignore inbound override:

```json
{
  "decision": "DENY",
  "reason": "DNC_NATIONAL_VIOLATION",
  "evidence_id": "ev_...",
  "retell": { "end_call": true, "response": { "action": "hangup" } }
}
```

Litigator hits (`LITIGATOR_TRAP`) are evaluated **before** DNC violations in the gate ladder.
