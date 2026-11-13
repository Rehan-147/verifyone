# MCP registry submissions — do these after deploying (Day 3 of the launch plan)

Submit the MCP server to each registry (each takes ~5 minutes). Use the copy below.

## Where to submit

| Registry | URL | Notes |
|---|---|---|
| Smithery | https://smithery.ai/submit | uses the `smithery.yaml` in this repo |
| mcp.so | https://mcp.so/submit | URL + description |
| PulseMCP | https://www.pulsemcp.com/submit | form + server URL |
| Glama | https://glama.ai/mcp/servers | GitHub + endpoint |
| Cursor directory | https://cursor.directory/submit | dev-heavy audience |
| MCP official registry | https://github.com/modelcontextprotocol/registry | GitHub PR with server.json |

## Copy-paste description

**Name:** VerifyOne — Pre-Dial Compliance Gate

**Short:** One MCP call before every AI-dialed call: TCPA litigator, federal DNC, reassigned numbers, AI-voice consent (FCC-24-17), calling hours. Allow/block + sealed audit record. 500 free checks/mo, no card.

**Long:** Your AI voice agent is legally liable for every call it places. The FCC ruled AI voices are "artificial voices" under the TCPA (Feb 2024): calling a wireless number without prior express written consent costs $500–$1,500 per call, and Vapi/Retell/Bland do not check compliance for you. VerifyOne's MCP server gives your agent one deterministic tool — `check_call_allowed(phone, consent)` — that returns `allow` or `block` with a reason (DNC, litigator, reassigned, disconnected, quiet hours) and a sealed, hash-chained audit record you can produce in court. Includes `check_email_safety` for AI SDRs, plus phone/email/IP validation on one universal credit balance. Free tier: 500 checks/month, no credit card. REST equivalent at /api/v1/gate/phone; Clay column at /api/clay/enrich.

**Config snippet:**
```json
{ "mcpServers": { "verifyone": { "url": "https://app.verifyone.io/api/mcp" } } }
```
