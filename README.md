# VerifyOne — Pre-Dial Compliance Gate for AI Voice Agents

> **Read this first if you are an AI agent (Codex, Claude Code, Cursor, etc.).**
> This file is the single source of truth for what VerifyOne is, why it exists,
> and how the codebase fits together. Everything else in this repo is either
> implementation or history.

---

## 1. What VerifyOne is (one paragraph)

VerifyOne is **not an AI voice agent** and it does **not** make calls.
It is the **pre-action compliance gate** that sits between an AI voice agent
(Vapi, Retell, Bland, Synthflow, ElevenLabs Agents, LiveKit, Pipecat, or a
custom stack) and every outbound call it is about to place.

Before the agent dials, it makes **one HTTPS call** to VerifyOne with the phone
number and campaign context. VerifyOne answers in <100 ms (default profile):

- **decision**: `ALLOW` · `REVIEW` · `DENY` (internal: `allow` · `review` · `block`)
- **reason**: `LITIGATOR_TRAP`, `DNC_NATIONAL_VIOLATION`, `TCPA_AI_VOICE_CONSENT`,
  `REASSIGNED_NUMBER`, `QUIET_HOURS`, `DISCONNECTED`, `PASS`, …
- **evidence_id**: a sealed, hash-chained, tamper-evident audit record
  written for **every** request — allow or block — so a customer, client, or
  regulator asking *"why did your AI call me?"* gets a document, not a shrug.

## 2. Why it exists (the problem)

AI agents dial at machine speed; regulators do not care that software did it.
TCPA statutory damages run **$500–$1,500 per call**, and one bad list can end an
agency. The compliance steps (consent records, federal DNC scrubbing,
reassigned-number checks, permitted calling hours, opt-out suppression,
litigator screening, audit trails) are exactly what agents **cannot** do by
themselves — and what VerifyOne replaces with one callable decision.

## 3. The one call — public contract

```http
POST /api/v1/gate/phone
Authorization: Bearer vk_live_xxx        (or free-tier IP quota: 500 checks/mo)

{
  "phone": "+14155550123",
  "channel": "ai_voice",
  "campaign_type": "sales",
  "consent": {
    "status": "express_written",          // express_written | ebr | none
    "captured_at": "2026-11-01T18:22:00Z",
    "captured_by": "web_form",
    "trustedform_cert_url": "https://cert.trustedform.com/…"  // optional; adds cert verification
  },
  "profile": "ai_outbound_shield" | "full_stack"   // full_stack adds live HLR + RNDB, ~800ms
}

→ { "decision": "ALLOW|REVIEW|DENY", "reason": "…", "risk_score": 4,
    "checks": { … }, "evidence_id": "ev_…", "latency_ms": 87,
    "priority": { "litigator_scrub": false, "dnc_scrub": false },
    "data_sources": [ … vendor provenance receipts … ] }
```

CHECKS run per decision (all bundled in every profile)
internal_suppression · FTC DNC · FCC reassigned-number (RNDB) · carrier/line status
· litigator scrub · consent type (FCC AI-voice rule: AI voice = prior express
WRITTEN consent for mobile/voip) · calling hours (8am–9pm local, NPA→timezone)

FAMILY of endpoints: `/api/v1/gate/phone`, `/gate/email` (AI SDR send gate),
`/gate/batch`, `/gate/stats`, `/gate/ticket/[id]`, `/gate/audit/[id]`,
`/registry-health`, `/data-sources`.

## 4. End-to-end lifecycle (how a decision happens)

```
AI agent / platform (Vapi, Retell, n8n, GHL, custom)
   │  about to dial
   ▼
gate entrypoint── 3 paths, one engine ----------------------------------------------------------------┐
│  A. direct API   POST /api/v1/gate/phone                                  │
│  B. platform webhooks: /api/webhooks/vapi (pre-connect server URL) ,
│                        /api/webhooks/retell (pre-call webhook)            │
│  C. MCP server tool (app/api/mcp) for agent-native frameworks             │
└──────────────────────────────────────────────────────────────────────────┤
   ▼ lib/gate.ts runPhoneGate ── 95ms budget (shield) / 800ms (full_stack)  │
   profile ai_outbound_shield: local registry sets, no live HLR ping        │
   profile full_stack: + Telnyx HLR + RNDB reassigned check                 │
   ┌─ upstream.ts   Telnyx lookups (line type, disconnected, carrier)      │
   ├─ compliance-cache.ts  zero-hop Sets: .data/dnc-us.txt + litigators    │
   ├─ rndb.ts             reassigned-number (generic provider or Twilio)  │
   ├─ trustedform.ts      consent certificate verification (optional)     │
   └─ calling hours       real NPA→IANA timezone map (in gate.ts)         │
   ▼ decision ladder (fail-closed default: if we can't answer, BLOCK)      │
   invalid_number → disconnected → litigator → reassigned-no-consent
   → DNC-no-consent → ai-voice-consent → review-unavailable → quiet hours
   ▼
audit-store.ts sealEvidence → hash-chained JSONL/Postgres record + evidence_id
   ▼
response (platform-shaped payload for webhooks: Vapi endCall / Retell hangup)
Post: HubSpot contact webhook writes verifyone_status/reason/evidence_id back
      to the CRM; /api/cron/sync-registries refreshes DNC + litigator files.
```

## 5. Data sources — status

| Check | State | What makes it real | Notes |
|---|---|---|---|
| Validity / E.164 / calling hours | **live** | nothing more | NPA map in `lib/gate.ts` |
| Line type / disconnected / carrier | **live** | `TELNYX_API_KEY` | Telnyx, cached; dev falls back to mocks |
| FTC DNC | **live (cache)** | set `DNC_REGISTRY_URL` (area-code scoped downloads from telemarketing.donotcall.gov; free subscriber account) + run cron | ⚠️ full registry = hundreds of millions of records — file `Set` is NOT scale-safe; see Next Tasks #1 |
| Canada DNCL (CRTC) | **live (cache, adapter shipped)** | registrant access → set `DNC_CA_REGISTRY_URL` (same `{areacode}` template; defaults to major CA NPAs) → `.data/dnc-ca.txt` | same 10-digit lookup answers both NANP registries; receipt says `crtc_dncl_cache` vs `ftc_registry_cache` |
| Litigator scrub | **shell** | feed vendor (Blacklist Alliance / DNC.com / RealValidation) → `LITIGATOR_REGISTRY_URL` | `.data/litigators.txt` currently empty — set must be populated |
| Reassigned (RNDB) | **live (adapter)** | `RNDB_API_KEY`+`RNDB_API_URL`, or `TWILIO_ACCOUNT_SID`+`TWILIO_AUTH_TOKEN` (Lookup v2 `reassigned_number` field) | unavailable-on-purpose otherwise; `review` decision covers stale consent |
| Consent | **declared + cert verify** | `TRUSTEDFORM_API_KEY` (+ optional `TRUSTEDFORM_API_URL`) verified on `full_stack` profile | without key = customer-declared only |
| Internal suppression | **live** | bulk CSV → per-account sets | ship per-campaign scoping |
| State DNC lists | **absent** | phase 2 (vendor bundle or per-state) | |

`/api/v1/registry-health` and `/api/v1/data-sources` expose readiness +
provenance receipts per decision — auditors and enterprise buyers expect this;
it is already built (`lib/data-sources.ts`, `lib/compliance-cache.ts`).

## 6. Platform integrations — status

| Platform | Status | Surface |
|---|---|---|
| Vapi | **implemented** | pre-connect server URL webhook → `endCall` on DENY |
| Retell AI | **implemented** | pre-call webhook → hangup on DENY |
| MCP server | **implemented** | `POST /api/mcp` — agent-native tool; list on Smithery (`smithery.yaml` exists, submission pending) |
| HubSpot | **implemented** (pending live-key verification) | signed v3 webhook → gate → writes `verifyone_status / reason / evidence_id` back to the contact |
| Clay | **implemented** | `/api/clay/enrich` |
| Bland / Synthflow / ElevenLabs / LiveKit / Pipecat / n8n / Make / Zapier / GHL | via generic HTTPS call to the gate API | labelled honestly on the site |

House rule (this repo's own content rule): **never claim an integration is
native unless it exists AND has been tested.** Keep the labels honest.

## 7. Right now — Next Tasks (priority order)

**Done since the 2026-11 audit:**
- Pricing ladder rebuilt to margin math: **Starter $299 · Growth $899 · Pro $2,399** (≈60% gross margin at every tier; Dodo dashboard must be synced to these before live checkout)
- `full_stack` rebalanced to **5 credits/check** (+ TrustedForm verification = +1 credit add-on) — premium vendor fees no longer absorb into plans
- `review` decision live end-to-end (gate → contract → webhooks hold the call)
- RNDB adapter (`lib/rndb.ts`), TrustedForm adapter (`lib/trustedform.ts`)
- Area-code-scoped DNC ingest (`{areacode}` template in `DNC_REGISTRY_URL` + `DNC_AREA_CODES`)
- **M1 — Canada DNCL (CRTC)**: dual-registry ingest (`lib/registry-ingest.ts` `ingestDncCaRegistry`) + dual-set local check (`ftc_registry_cache` / `crtc_dncl_cache` receipts), catalog + health row, `DNC_CA_REGISTRY_URL`/`DNC_CA_AREA_CODES` envs
- **Evidence hand-off export**: `GET /api/v1/gate/audit/{id}/export` (JSON or `?format=html`) — HMAC-signed single-record compliance artifact (label param covered by the signature; `EVIDENCE_EXPORT_SECRET`)
- **Data source status tile** in Dashboard Overview (+ `fix_hint` on every receipt) — the fail-closed story is self-serve
- **Usage endpoint** `GET /api/v1/account/usage` — exact balance, meters, honest zero-balance behavior (cost-predictability contract)
- **Fail-closed credits at zero**: `creditsAvailable()` guard on all 10 metered routes — APIs 402 `insufficient_credits`, voice webhooks HOLD with reason `insufficient_credits` (previously: meters clamped at 0 and served free)
- **Dashboard de-staled**: Billing tab now renders `lib/plans.ts` ($299/$899/$2,399) instead of hardcoded $49/$199/$499; gate banner shows the real ALLOW/REVIEW/DENY enum; removed untested "90-day rollover" claim
- **Lead-intake consent capture** `POST /api/webhooks/lead-intake` — platform-neutral intake webhook (GHL/JotForm/Zapier/n8n mapping table in `docs/integrations/lead-intake-webhooks.md`): seals the consent claim at form time → intake → gate → outcome chain per lead
- Post-call outcome ledger: `POST /api/v1/gate/outcome` (feeds opt-out suppression + consent freshness)
- GHL webhook-action template (`docs/integrations/gohighlevel.md`), Vapi-MCP setup guide (`docs/integrations/vapi-mcp.md`), Smithery pack refreshed (`smithery.yaml` v1.1)
- **Design system applied — astryx**: vendored the prebuilt theme CSS `@astryxdesign/theme-neutral@0.7.12` (MIT — Meta Platforms; `vendor/design-system/astryx-neutral-theme.css` + `astryx-neutral.LICENSE`; imported in `app/layout.tsx` **before** `globals.css`). VerifyOne tokens (tailwind.config.js + both light `:root` blocks in globals.css) map to its **resolved LIGHT values** — ramp refs `neutral.light[N]`, accent = its blue ramp (`--color-info` #0074e2) — because its vars are `@scope`-gated behind `data-astryx-theme` (inert otherwise) and Tailwind-3 opacity modifiers (`bg-accent/10`) cannot alpha-modify `var()` colors. Documented deviations: fonts stay Plus Jakarta Sans / IBM Plex (not Figtree; `fonts.css` not imported), blue action color instead of the verbatim monochrome neutral accent, dark-theme block unchanged. `scripts/vendor-astryx-theme.mjs` reproduces the vendoring; social card (`opengraph-image.tsx`) fixed for satori's multi-child `display` contract and re-rendering 200 PNG

**Remaining (external accounts / later phase):**
1. **Dodo dashboard sync** — update 3 products to $299/$899/$2,399 with 30k/120k/400k credits, then one test-mode E2E per plan (DEPLOY.md §6b)
2. **Registry vendor wiring** — `DNC_REGISTRY_URL` (telemarketing.donotcall.gov, free SAN) + litigator feed contract (`LITIGATOR_REGISTRY_URL`); RNDB path: `RNDB_API_URL`+`RNDB_API_KEY` or Twilio Lookup RND; TrustedForm: `TRUSTEDFORM_API_KEY`
3. **`.data` → Postgres** (`audit-store` → `audit-db` path; JSONL is not serverless-safe) — before Vercel
4. **Email OTP on signup** before issuing `vk_live_…` keys
5. **Legal pages counsel review + "compliance controls ≠ legal advice" disclaimer**
6. **Salesforce write-back** (HubSpot parity), **review-hold UI** in dashboard, **overage metering** at 2x (needs Dodo usage-based product)
7. Directory listings: Zapier/Make listings + MCP directories (copy ready in `docs/integrations/vapi-mcp.md`)
8. CI: `tsc --noEmit` + gate tests (TZ matrix, consent sufficiency, fail-closed); delete the `*_1`/`*_2` twin scaffolds

## 8. Dev runbook

```bash
npm install                     # postinstall runs prisma generate
cp .env.example .env            # every key optional; mocks when unset
npx prisma db push              # optional (Postgres path)
npm run dev                     # http://localhost:3000

# smoke test the gate (dev: deterministic mock registries respond)
curl -s http://localhost:3000/api/v1/gate/phone \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","consent":{"declared":true,"type":"express_written"}}' | jq

# NOTE: if :3000 answers with errors that reference unknown contract strings,
# ANOTHER Next project (e.g. D:\leadops) owns the port — VerifyOne then runs on
# a separate port: npx next dev -p 3100

# registries (after DNC_REGISTRY_URL / LITIGATOR_REGISTRY_URL set)
curl -s -X POST http://localhost:3000/api/cron/sync-registries -H "x-cron-secret: $CRON_SECRET"
curl -s http://localhost:3000/api/v1/registry-health | jq

# post-call outcome (closes the loop; opt_out feeds suppression)
curl -s http://localhost:3000/api/v1/gate/outcome \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","evidence_id":"ev_...","outcome":"booked"}'

# evidence hand-off (the artifact a client/auditor reads)
curl -s "http://localhost:3000/api/v1/gate/audit/ev_.../export?label=Client+Roofing+LLC" | jq
#   or ?format=html for the printable one-pager (HMAC-signed; set EVIDENCE_EXPORT_SECRET)

# usage / predictability
curl -s http://localhost:3000/api/v1/account/usage -H "Authorization: Bearer $VERIFYONE_API_KEY" | jq

# chain integrity (auditor view)
curl -s http://localhost:3000/api/v1/gate/audit/chain | jq

# DEV-ONLY: repair the local file chain if /audit/chain shows a fracture
# (root cause: two dev-server processes appending, or a kill mid-seal).
# STOP the dev server first. Never run against a production ledger (Postgres path).
node scripts/repair-local-chain.mjs
```

Known file-mode pitfall (documented, do not hide): with `.data/*` persistence and
two `npm run dev` processes running simultaneously, both adopt the tail and appends
interleave → prev_hash breaks. Single-record integrity stays valid; only links break.
`scripts/repair-local-chain.mjs` re-stamps links in dev; the real fix is the Postgres
migration (Next Tasks #3).

Pricing/billing single source: `lib/plans.ts` (Starter $299 / Growth $899 /
Pro $2,399 — ≈60% gross margin ladder; full_stack profile = 5 credits/check;
TrustedForm verification = +1 credit). Payments: **Dodo Payments**
merchant-of-record — checkout + webhook (`/api/webhooks/dodo`) already built.

## 9. House rules for AI agents

- The product concept is the **pre-dial gate for AI agents**. Do not drift:
  it is not a voice agent, not a "1Lookup validation clone" (legacy validation
  routes exist but are a funnel feature, not the product).
- Compliance defaults are **fail-closed**: missing registry/keys in production
  BLOCK, never silently ALLOW. Preserve that property in every change.
- `lib/plans.ts` is the only place plan/price/credits are defined.
- Never promise unverified integrations in UI copy (see §6 rule).
- Legacy `_1`/`_2` twin files are dead scaffolding — edit the canonical file,
  never the twins.
