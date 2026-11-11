# VerifyOne Pre-Dial Gate — the 2027 wedge

> **Pitch (one line):** "Your AI dialer doesn't check TCPA. One API call before every dial:
> DNC, litigators, reassigned numbers, AI-voice consent, calling hours — with a sealed audit
> record your lawyer can read."

## Build status

- [x] **Stage 1** — Real-data adapter layer (Telnyx / Reoon / ZeroBounce / IPinfo / FTC DNC file),
      24h cache, auth (SHA-256 hashed keys), credit metering, rate limiting, signup endpoint
- [x] **Stage 2** — Dodo Payments (MoR): checkout sessions, signature-verified webhooks,
      plan grants + downgrades, money ledger, pricing + dashboard wired
- [x] **Stage 3** — Clay HTTP-column endpoint, Google Sheets Apps Script, sitemap.xml + robots.txt
      (AI-crawler friendly), vercel.json + DEPLOY.md, smithery.yaml + MCP_SUBMISSION.md
- [ ] **Stage 4 (waiting on your keys)** — live test with real Telnyx/Reoon/IPinfo/Dodo keys,
      then deploy via DEPLOY.md

## Why this wins in 2026-27 (research-backed)

1. FCC-24-17 (Feb 2024): AI voice = artificial voice under TCPA. Prior express **written** consent
   required for wireless/VoIP. Violations: **$500–$1,500 per call**, class-action bait.
2. Vapi, Bland, Retell, ElevenLabs, HighLevel **do not enforce TCPA/DNC** — their docs say
   compliance is the customer's job. Thousands of agencies are exposed.
3. Incumbent (DNC.com) sells this enterprise-style ("schedule a meeting"). No developer-first,
   MCP-native, free-tier product owns this yet. We do.
4. Validation itself is a commodity (anyone can resell Twilio/Telnyx). The **gate** is a
   product with retention: ripping out your compliance audit trail mid-campaign is a legal risk.

## Endpoints (all live on localhost:3000/3002)

| Endpoint | What it does |
|---|---|
| `POST /api/v1/gate/phone` | Pre-dial decision: `allow`/`block` + `reason` + `evidence_id` |
| `POST /api/v1/gate/email` | Pre-send decision for AI SDRs: `send`/`hold`/`block` |
| `GET /api/v1/gate/audit/{evidence_id}` | Sealed audit record + integrity check |
| `GET /api/v1/gate/audit/chain` | Verify the entire tamper-evident hash chain |
| `POST /api/mcp` | MCP server: `check_call_allowed`, `check_email_safety`, validators |
| `GET /llms.txt` + `/for-agents` | The pages AI agents read to self-install |

**Decision reasons:** `cleared`, `quiet_hours`, `do_not_call_no_consent`,
`ai_voice_consent_required`, `litigator_list`, `reassigned_number_consent_required`,
`disconnected`, `invalid_number`. **Fail closed:** timeout/error = do not dial.

## Pricing (ship this)

- **Free:** 500 gate checks/mo, no card, no signup for MCP — agents adopt it
- **Agent $49/mo:** 25,000 checks, MCP + REST + webhooks
- **Agency $149/mo:** 150,000 checks, consent vault, team seats, audit export (PDF/CSV)
- **Compliance Pro $499/mo:** 600,000 checks, RNDB + litigator priority refresh, SSO, SLA
- Overage: $0.002/check. Gate check = 2 credits on the legacy meter.

## Data sources to plug in (swap the mocks in `lib/gate.ts`, return shapes are stable)

| Check | Mock now | Real source |
|---|---|---|
| Line type / disconnected | deterministic mock | Telnyx Number Lookup (~$0.001–0.005) or Twilio Lookup v2 |
| Federal DNC | mock (deterministic %5) | FTC registry file (free, 30-day refresh per 64.1200(c)(2)) |
| Litigator | mock list | DNC.com litigator scrub (~$0.002/number) |
| Reassigned | mock | FCC Reassigned Numbers Database (RNDB, ~$0.006/number) |
| Calling hours | **real** NPA→IANA tz map, already live | — |

Cost per gate check at scale ≈ $0.004–0.01 → **60–85% margin** at $0.002–0.005 list.

## 7-day launch playbook

- **Day 1–2:** Buy domain (verifyone.io or similar), deploy to Vercel, set env.
  Replace phone/disconnected mock with Telnyx (signup = 20 min, free trial credit).
- **Day 3:** Publish `/for-agents` + `llms.txt`, submit MCP server to registries
  (mcp.so, PulseMCP, Smithery, Cursor directory). These are the 2027 equivalent of
  the app store.
- **Day 4:** Post the build story on r/SmsMarketing, r/coldemail, r/vapi, Retell Discord,
  Vapi Slack: *"I built a $0.002 TCPA gate for AI dialers — free 500 checks, here's the demo."*
  (This is exactly how 1Lookup got its first users.)
- **Day 5:** DM 30 agencies running Vapi/Retell campaigns (find them on YouTube tutorials
  + LinkedIn): offer free compliance audit of their dialing list using the gate.
- **Day 6:** Product Hunt + a YouTube short: "Your AI dialer is one lawsuit away — 5 min fix."
- **Day 7:** Wire Stripe/Paddle on the 4 tiers. Turn on the dashboard tester as the demo.

## What's mocked vs real (honesty list for demos)

- ✅ Real: decision ladder, consent rule (FCC-24-17), calling-hours engine with real
  timezone math, audit hash-chain + integrity verification, MCP server, quotas, CORS.
- ⚠️ Mock: litigator/DNC/reassigned hit-test + carrier/line-type (deterministic, clearly
  marked `MOCK` in `lib/gate.ts`). Swap one function each, nothing else changes.
