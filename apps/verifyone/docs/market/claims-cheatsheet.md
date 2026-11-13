# VerifyOne claims cheatsheet — what we may promise, and the proof for it

House rule: **never claim an integration or check is live unless it exists AND has
been tested.** Before promising anything below, run its proof command. If the
proof fails, the claim does not ship today — fix it or park it in README §7.

The five expectations buyers repeat (segment map in outreach notes):

## 1. "Give me proof I can hand my client / auditor"
| Claim | Proof before saying it |
|---|---|
| Every decision leaves a sealed, hash-chained record with `evidence_id` | Gate response contains `evidence_id`; `GET /api/v1/gate/audit/{id}` returns `integrity.hash_matches: true` |
| One-record hand-off doc, HMAC-signed, printable | `GET /api/v1/gate/audit/{id}/export` (JSON) and `?format=html`; signature verifies with the embedded openssl line (needs `EVIDENCE_EXPORT_SECRET` set) |
| Whole-ledger tamper check | `GET /api/v1/gate/audit/chain` → `{ verifiable: true, valid: true }` |
| Bulk CSV export | `GET /api/v1/gate/audit/export` with a PAID key → CSV (FREE tier gets 403 — say so) |
| Per-client branded exports / sub-accounts | **DO NOT CLAIM YET** — single label param only; sub-accounts not built |

## 2. "It runs where my calls run, without changing my dial flow"
| Claim | Proof before saying it |
|---|---|
| Vapi/Retell outbound gate-then-dial | The examples in `docs/integrations/vapi.md` and `retell.md` call `/api/v1/gate/phone` first and create the platform call only on `ALLOW`; the customer workflow must enforce this branch. |
| Vapi/Retell inbound screening (beta) | Rejects invalid numbers and flags matches in the loaded litigator list. Per-account block-list lookup is not wired yet; outbound DNC/consent rules are not applied. |
| MCP endpoint for agents | `POST /api/mcp` — `smithery.yaml` pack; not yet listed on registries (submissions pending) |
| GoHighLevel | Custom webhook action template only (`docs/integrations/gohighlevel.md`) — **marketplace app does not exist yet** |
| HubSpot webhook adapter | Implemented in code, beta and **not verified against a live account** — do not imply a production-ready integration |
| Salesforce | **DO NOT CLAIM** |

## 3. "Fail closed, and warn me when you're degraded"
| Claim | Proof before saying it |
|---|---|
| Missing data never silently allows; REVIEW for inconclusive | Dev-test: missing registries in prod mode → DENY `registry_unavailable_fail_closed`; cert without key → REVIEW `consent_cert_unverified` |
| Self-serve status view | `GET /api/v1/registry-health` + Dashboard Overview "Data source status" tile (green/red + fix hints) |
| Voice-level hold on empty balance | Webhooks return the platform hold payload with reason `insufficient_credits` on zero credits (400 on misuse; **200**, never a webhook error) |
| Production UPTIME SLA | **DO NOT CLAIM** — no status page/SLO yet |

## 4. "No surprise charges — I always know the cost per dial"
| Claim | Proof before saying it |
|---|---|
| Flat monthly plans $299 / $899 / $2,399 (30k / 120k / 400k credits) | `lib/plans.ts` is the single source; homepage + dashboard + checkout all read it |
| One universal balance: shield 1 · full_stack 5 · TrustedForm +1 | `GET /api/v1/account/usage` shows exact live balance + meters; gate responses show `bundle_credits` |
| Fail closed at zero (402 / held call) | `/api/v1/account/usage` `zero_balance_behavior`; test an empty account |
| Overage billing at 2x | **DO NOT CLAIM** — needs Dodo usage-based product; balances are top-up/renewal only today |

## 5. "Tell me honestly what's covered — don't make me your test case"
| Claim | Proof before saying it |
|---|---|
| Coverage published per source, with receipts on every decision | `GET /api/v1/data-sources` (catalog) + `data_sources` receipts in each gate response |
| US FTC DNC, Canada CRTC DNCL (NANP), litigator, RNDB, TrustedForm, Telnyx line-type | Check `/api/v1/registry-health` — a source only counts when its receipt says `loaded`/`live` with records |
| State DNC lists (FL/TX/OK/WY) | **DO NOT CLAIM** — phase 2 |
| Legal advice / "you are TCPA-safe" | **NEVER claim** — compliance controls ≠ legal advice (disclaimer on every artifact) |

## The 10-minute proof (use this first in every sales call)

```bash
# 1. Decide
curl -s -X POST https://app.verifyone.io/api/v1/gate/phone \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","consent":{"declared":true,"type":"express_written"}}'
# -> ALLOW + evidence_id

# 2. Close the loop
curl -s -X POST https://app.verifyone.io/api/v1/gate/outcome \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","outcome":"booked","evidence_id":"ev_..."}'

# 3. Show the artifact the customer hands their client
open https://app.verifyone.io/api/v1/gate/audit/ev_.../export?format=html
```
