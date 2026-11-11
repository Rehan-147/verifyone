# Vapi — VerifyOne as a native MCP tool (2026)

Vapi's tool system supports **Model Context Protocol tools** directly — meaning
VerifyOne's MCP server (`/api/mcp`) can attach to any assistant **without a
webhook server URL**, alongside (or instead of) the already-implemented
pre-connect webhook path.

## When to use which

| Path | What it does | Best for |
|---|---|---|
| Pre-connect server URL webhook (`/api/webhooks/vapi`) | VerifyOne decides *before the trunk connects*; DENY → `endCall` | Hard enforcement, every call checked |
| MCP tool call (`/api/mcp`) | The assistant/agent itself asks the gate (e.g. inside a function step before outbound dial tool) | Agentic workflows, batch dialers, MCP-first stacks |

Both write sealed evidence records; use the webhook for enforcement and the MCP
tool in agent reasoning loops, or both (defense in depth).

## Configure the MCP tool in Vapi

1. Vapi dashboard → assistant → **Tools → Add Tool → MCP**
2. Server URL: `https://app.verifyone.io/api/mcp`
3. Auth header: `Authorization: Bearer vk_live_...` (or run free at 500 checks/mo under your IP)
4. Tool name mapping (listed in `smithery.yaml`):
   - `check_call_allowed` → gate/phone decision
   - `check_email_safety` → gate/email decision

5. In the assistant's call flow, call the tool **before** the outbound dial step:

```
before: outbound_call(phone)
tool:   check_call_allowed(phone, consent_type, channel="voice")
on:     ALLOW → proceed
        REVIEW → transfer to human queue
        DENY   → skip call, log evidence_id
```

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
