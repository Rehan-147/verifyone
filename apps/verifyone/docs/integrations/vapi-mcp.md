# Vapi workflows — VerifyOne REST gate and MCP decision tool

Vapi has no customer webhook before an outbound dial: its outbound `POST /call`
starts dialing. For outbound calls, the scheduler or workflow must call VerifyOne
first and call Vapi only when the result is `ALLOW`. VerifyOne dial-through, where
it places the call for you, is coming soon. See [`vapi.md`](vapi.md) for the full
gate-then-dial example and inbound screening beta.

## When to use which

| Path | What it does | Best for |
|---|---|---|
| REST gate-then-dial (`/api/v1/gate/phone`) | Your scheduler gets a decision, then creates the Vapi call only on `ALLOW` | Outbound workflows where your application controls call creation |
| MCP tool call (`/api/mcp`) | The agent asks for a decision in an MCP-enabled workflow | Agent reasoning; hard enforcement still depends on the call action being gated on `ALLOW` |
| Inbound webhook (`/api/webhooks/vapi`) | Rejects invalid callers, flags matches in the loaded litigator list, and returns an assistant ID or error | Inbound screening beta; per-account block-list lookup is not wired; outbound DNC/consent rules are not applied |

REST and MCP gate decisions write sealed evidence records. The inbound webhook
is a separate beta path: it does not run the outbound DNC, consent, calling-hours,
reassigned-number, or line-type checks.

## Use the MCP tool where supported

1. Add the VerifyOne MCP server URL `https://app.verifyone.io/api/mcp` in an MCP-capable workflow.
2. Set the auth header: `Authorization: Bearer vk_live_...` (or use the IP free tier).
3. Tool names (listed in `smithery.yaml`):
   - `check_call_allowed` → gate/phone decision
   - `check_email_safety` → gate/email decision

4. In the assistant's call flow, call the tool before the outbound dial step and make the dial action conditional on `ALLOW`:

```
before: outbound_call(phone)
tool:   check_call_allowed(phone, consent_type, channel="voice")
on:     ALLOW → proceed
        REVIEW → transfer to human queue
        DENY   → skip call, log evidence_id
```

An agent tool call alone is not a platform-level pre-dial hook. Use the REST
gate-then-dial pattern when your scheduler creates outbound calls.

## Self-test before going live

```bash
# direct API contract (same decision the MCP tool returns)
curl -s http://localhost:3000/api/v1/gate/phone \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","consent":{"declared":true,"type":"express_written"}}'

# registry readiness
curl -s http://localhost:3000/api/v1/registry-health
```

## Listing checklist (once domain is live)

- [ ] Smithery (config already in repo: `smithery.yaml`, v1.1)
- [ ] mcp.so, PulseMCP, Glama, Cursor directory (same copy)
- [ ] Vapi community showcase post (Discord)
- [ ] Retell showcase/partner page request
