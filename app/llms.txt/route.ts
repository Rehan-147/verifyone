// /llms.txt — the file AI agents and crawlers read to understand this site.
import { NextResponse } from 'next/server';

export async function GET() {
  const txt = `# VerifyOne

> Pre-action compliance gate for AI calling and messaging agents.
> Before an agent dials or sends, it calls VerifyOne. One POST runs the enabled
> checks — litigator scrub (first), federal DNC, reassigned-number risk, consent,
> calling hours — and returns an auditable decision plus a tamper-evident
> evidence_id. The agent must respect the decision.

## Product contract
ALLOW | DENY, with a machine-readable reason code and an evidence_id.
A native "review" state is on the roadmap; until it ships the gate is binary
and fails closed. The legacy decision_legacy field maps to allow | review | block.

## Primary contract (live v1)
POST /api/v1/gate/phone
Body: {"phone":"+14155550123","channel":"voice","consent":{"declared":false,"type":"none"},"profile":"ai_outbound_shield"}
Response: {"decision":"ALLOW|DENY","reason":"PASS|LITIGATOR_TRAP|DNC_NATIONAL_VIOLATION|REASSIGNED_NUMBER|QUIET_HOURS|...","evidence_id":"ev_...","risk_score":0-100}

Dial ONLY on decision:"ALLOW". Timeout = DENY (fail closed).
Decision mapping and full reference: /docs#decision-values

## Bundled metering (launch)
profile ai_outbound_shield (default): 1 bundled credit = validity + litigator + DNC + consent + calling hours (local cache, sub-100ms target).
profile full_stack: 3 credits, adds live HLR/carrier ping when TELNYX_API_KEY is set.

## Voice platform webhooks (drop-in)
POST /api/webhooks/vapi   — Vapi server-url / pre-connect; DENY returns endCall payload
POST /api/webhooks/retell — Retell pre-call; DENY returns hangup hints
All other platforms: integrate via REST, MCP, or a custom function.

## MCP
POST /api/mcp — tools: verifyone_pre_dial_gate (alias of check_call_allowed),
check_email_safety, validate_phone, verify_email, ip_lookup, bulk_verify, get_account.
Agent prompt rule: before any outbound call or message, call verifyone_pre_dial_gate.
block → do not proceed. review → pause or transfer to a human. allow → proceed and
store the evidence_id. (Live responses use ALLOW | DENY today.)

## Data sources (credibility)
- FTC National DNC: free registry file -> .data/dnc-us.txt (local cache, zero per-lookup cost)
- Litigator list: .data/litigators.txt (export from DNC.com or your scrub vendor)
- Reassigned numbers: FCC RNDB pattern (requires loaded data file; otherwise reported unavailable)
- Live carrier/HLR: Telnyx Number Lookup (optional, full_stack profile only)
- Live receipts: GET /api/v1/registry-health or /status

## Docs
/docs          — full API documentation (quickstart, decisions, fail-safe policy, MCP, credits)
/for-agents    — agency guide (workspaces, suppression, evidence exports)
/for-platforms — platform partnership (embed the gate, white-label)
/pricing       — plans and credits
/security      — data handling and subprocessors
/status        — endpoint status and data-source receipts
/llms.txt      — this file
`;
  return new NextResponse(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
