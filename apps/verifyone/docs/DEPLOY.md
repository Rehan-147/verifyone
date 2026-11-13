# VerifyOne — Vercel environment variables

Every key is **optional at boot** — nothing throws. In development the product runs on
deterministic mocks and auth/audit persist to `.data/*.json`; keys flip individual
subsystems to live.

In **production the mocks are off** (`allowDevMocks()` is false), so the picture changes:
with no registry files the gate fail-closes on every dial, and with a read-only cwd the
`.data` writes are silently swallowed. Read the verified "COMPLIANCE_* behavior" table
below and the Database section before deploying.
For the step-by-step deploy see [`../DEPLOY.md`](../DEPLOY.md).

Set these in **Vercel → Settings → Environment Variables** for *Production* and
*Preview*, then redeploy. Redeploying is required — `process.env` is read at boot, and
several GET routes are baked at build time.

## Core

| Key | Read at | Required for | Without it |
|---|---|---|---|
| `APP_URL` | `app/layout.tsx`, `app/api/billing/checkout/route.ts` | webhook + sitemap + MCP doc URLs | falls back to the request origin; checkout return URL may be wrong |

## Compliance gate — the product

The gate is what distinguishes VerifyOne. These control whether it can honestly
return `ALLOW`.

| Key | Read at | Required for | Without it |
|---|---|---|---|
| `DNC_REGISTRY_URL` | `lib/registry-ingest.ts` | pull the FTC DNC file into `.data/dnc-us.txt` via `POST /api/cron/sync-registries` | DNC check runs on whatever is already cached (empty on a cold deploy) |
| `LITIGATOR_REGISTRY_URL` | `lib/registry-ingest.ts` | pull litigator trap numbers into `.data/litigators.txt` | litigator scrub has no records to match |
| `COMPLIANCE_REQUIRE_REGISTRIES` | `lib/compliance-policy.ts` | hard-fail instead of serving uncached traffic | **defaults to on in production** |
| `COMPLIANCE_ALLOW_DEV_MOCKS` | `lib/compliance-policy.ts` | permit mock upstreams in a production build | `false` by default — leave it off in prod |
| `RNDB_API_KEY` | `lib/compliance-cache.ts` | FCC reassigned-number lookups (Tier 1, usage-based) | `checks.reassigned` is not live-verified |

Check health at `GET /api/v1/registry-health` (`shield_ready`, per-registry record
counts and `refreshed_at`) and `GET /api/v1/data-sources` for the SLA of each feed.

### `COMPLIANCE_*` — verified behavior (`next start`, `NODE_ENV=production`)

Both flags are compared as **exact strings**: only `COMPLIANCE_REQUIRE_REGISTRIES=false`
disables the requirement, and only `COMPLIANCE_ALLOW_DEV_MOCKS=true` enables mocks. An
empty value (`COMPLIANCE_REQUIRE_REGISTRIES=`), which is what `.env.example` ships, is
**not** `false` and therefore does not disable anything.

Registries count as ready only when **both** `.data/dnc-us.txt` and `.data/litigators.txt`
parse to at least one 10-digit record ([lib/compliance-cache.ts:104](../lib/compliance-cache.ts)).

| Env | Registries | Gate result |
|---|---|---|
| *(unset)* | absent | `DENY · REGISTRY_UNAVAILABLE`, `risk_score 95`, `checks.dnc.source = registry_not_loaded`. Every dial is blocked — fail-closed by design. |
| *(unset)* | both loaded | Full ladder runs against the local files. `dnc.source = ftc_registry_cache`, litigator hits report `local_litigator_registry`. Observed latency 8 ms (budget 95 ms). |
| `REQUIRE_REGISTRIES=false` | absent | Gate **answers anyway**. `dnc.source = dnc_cache_miss` and `listed: false` — it reports "not on DNC" having checked nothing. Only consent + quiet-hours still protect you. |
| `ALLOW_DEV_MOCKS=true` | absent | Fabricated verdicts in production: `dnc.source = federal_mock`, with ~1 in 5 real numbers randomly flagged DNC, plus mock litigator and RNDB hits. Never ship this. |

`mode: "fail_open"` on the request bypasses the registry block even in production; the
request then falls through to the consent check (`TCPA_AI_VOICE_CONSENT`) rather than
being allowed. Use `fail_open` only where a blocked dial is worse than an ungated one.

> `POST /api/v1/gate/phone` is dynamic and picks up newly written registry files within
> 60 s (mtime check in `maybeReload()`), with no restart.
>
> **`GET /api/v1/registry-health` and `GET /api/billing/plans` are statically cached** —
> they take no request and use no dynamic API, so Next.js bakes the response at build
> time (`x-nextjs-cache: HIT`). A verified production instance running with
> `COMPLIANCE_REQUIRE_REGISTRIES=false` still served `require_registries_in_production:
> true` from the build. Treat those two endpoints as *build-time* facts: after a registry
> sync, trust the gate's own `shield_ready` field, not `registry-health`, or add
> `export const dynamic = 'force-dynamic'` to both routes.

> Vercel's serverless filesystem is **ephemeral and read-only outside `/tmp`**.
> `.data/*.txt` files committed into the repo do deploy and are readable, but a
> `POST /api/cron/sync-registries` refresh will not survive or write back on
> serverless. For live registry refresh you need object storage (S3/R2) behind
> `DNC_REGISTRY_URL` + `LITIGATOR_REGISTRY_URL`, or run the ingest on a host with a
> writable disk. `vercel.json` schedules `sync-registries` weekly (`0 6 * * 0`).
>
> Note that `registry-ingest.ts` writes to `path.join(process.cwd(), '.data')` — not
> `/tmp` — so on Vercel it fails soft with `EROFS`/`EPERM` and returns
> `{ ok: false, reason: … }` rather than crashing. The cron route still answers `200`
> with `shield_ready: false`.
>
> `.data/` is ignored local state and registry files are not included in deployments.
> On Vercel, a missing registry keeps the gate fail-closed; filesystem refreshes cannot
> provide durable shared registry storage. Do not commit raw registry files. Before a
> production launch, configure a durable registry delivery path and confirm the health
> receipts show the expected source and freshness.

## Billing — Dodo Payments (merchant of record)

Dodo is the only checkout path. Stripe is not used for billing.

| Key | Read at | Required for | Without it |
|---|---|---|---|
| `DODO_PAYMENTS_API_KEY` | `lib/dodo.ts` | creating checkouts | `GET /api/billing/plans` reports `configured: false`; `/api/billing/checkout` returns the manual-invoice message |
| `DODO_PRODUCT_STARTER` | `lib/dodo.ts` (dynamic, `DODO_PRODUCT_${plan}`) | map plan `STARTER` → "Agent" $49/mo | checkout for that plan throws `DODO_PRODUCT_STARTER not set` |
| `DODO_PRODUCT_GROWTH` | `lib/dodo.ts` | map plan `GROWTH` → "Agency" $199/mo | as above |
| `DODO_PRODUCT_PRO` | `lib/dodo.ts` | map plan `PRO` → "Compliance Pro" $499/mo | as above |
| `DODO_PAYMENTS_ENVIRONMENT` | `lib/dodo.ts` | `test_mode` vs `live_mode` | defaults to test |
| `DODO_PAYMENTS_WEBHOOK_KEY` | `lib/dodo.ts` | signature verification on `POST /api/webhooks/dodo` | **every webhook is rejected** — credits never get granted |

Webhook events to subscribe to: `payment.succeeded`, `subscription.active`,
`subscription.renewed`, `subscription.cancelled`, `subscription.expired`.
Plan prices are defined once in `lib/plans.ts` — keep the Dodo products in sync with it.

## Cron

| Key | Read at | Required for | Without it |
|---|---|---|---|
| `CRON_SECRET` | `app/api/cron/digest/route.ts`, `app/api/cron/sync-registries/route.ts` | `x-cron-secret` header auth on both cron routes | the routes refuse to run |
| `DIGEST_WEBHOOK_URL` | `app/api/cron/digest/route.ts` | where the weekly ROI digest is delivered | digest is computed but not delivered |

Crons live in `vercel.json`: `digest` weekly (`0 13 * * 1`), `sync-registries` weekly (`0 6 * * 0`).

## Database (optional)

| Key | Read at | Required for | Without it |
|---|---|---|---|
| `DATABASE_URL` | `lib/db.ts` | Prisma/Postgres as the store for keys, accounts, audit | `dbEnabled()` is false → falls back to `.data/keys.json`, `.data/audit.jsonl`, `.data/usage.json` |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts` | browser-side Supabase client | Supabase-backed paths inactive |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts` | as above | as above |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/client.ts` | server-side writes bypassing RLS | — **never** expose as a `NEXT_PUBLIC_*` var |

The `.data/*` fallback is intentional and fine for local dev and early demos. Before
scaling or going live: set `DATABASE_URL`, run `npm run db:push`, and re-issue keys —
`.data/keys.json` stores only SHA-256 hashes, so existing plaintext keys cannot be migrated.

> **On Vercel, `DATABASE_URL` is not optional.** Every `.data` write in `lib/auth.ts` and
> `lib/audit-store.ts` is wrapped in `try {} catch {}` and the codebase assumes a writable
> cwd. Serverless gives you a read-only one, so nothing throws — the writes are silently
> dropped and persistence degrades to `persistence: "memory"` in the gate response.
> Concretely: `POST /api/auth/signup` returns a `vk_live_…` key that exists only inside
> that one warm invocation, so the next request — routed to a different lambda — gets
> `401 unauthorized`. Evidence seals the same way and disappears on the next cold start,
> which defeats the entire point of a defensible audit trail.
>
> Check the field, not the HTTP status: a gate `200` with `"persistence": "memory"` means
> you are running without a real store. `postgres` is the value you want.

## Upstream validators (feed the gate's phone/email/IP checks)

| Key | Read at | Required for |
|---|---|---|
| `TELNYX_API_KEY` | `lib/upstream.ts`, `app/api/v1/validate_phone/route.ts` | live carrier / line type / disconnected |
| `TWILIO_ACCOUNT_SID` | `app/api/v1/validate_phone/route.ts` | alternative phone upstream |
| `REOON_API_KEY` | `lib/upstream.ts`, `app/api/v1/verify_email/route.ts` | live email verification (cheapest) |
| `ZEROBOUNCE_API_KEY` | `lib/upstream.ts`, `app/api/v1/verify_email/route.ts` | alternative email upstream |
| `IPINFO_TOKEN` | `lib/upstream.ts`, `app/api/v1/ip_lookup/route.ts` | live IP / proxy / TOR / hosting signal |

Note the auth consequence: `POST /api/v1/{validate_phone,verify_email,ip_lookup}` only
require a Bearer key once a real phone upstream (`TELNYX_API_KEY` or `TWILIO_ACCOUNT_SID`)
is present. Keyless access is a deliberate dev affordance — deploying **without** those
keys leaves the endpoints openly callable against mock data.

## Integrations

| Key | Read at | Required for | Without it |
|---|---|---|---|
| `HUBSPOT_TOKEN` | `lib/integrations/hubspot.ts` | GET a contact's phone + PATCH the verdict back | the webhook answers `hubspot_not_configured` per event |
| `HUBSPOT_APP_SECRET` | `lib/integrations/hubspot.ts` (`verifyHubSpotSignature`) | signature auth on `POST /api/webhooks/hubspot` | **every delivery is rejected `401`** |
| `HUBSPOT_CONSENT_PROPERTY` | `app/api/webhooks/hubspot/route.ts` | a consent record the gate can honor | the gate is told there is no consent, so AI-voice dials are `DENY` |
| `NEXT_PUBLIC_SUPABASE_*` | see Database | — | — |

### HubSpot contact webhook — `POST /api/webhooks/hubspot`

Signature scheme is **v3 only**: `x-hubspot-signature-v3` = base64
`HMAC-SHA256(HUBSPOT_APP_SECRET, METHOD + REQUEST_URI + RAW_BODY + x-hubspot-request-timestamp)`,
method uppercase, no separators, timestamp within **±300s**. The older `x-hubspot-signature`
(plain SHA-256, no timestamp) is deliberately refused because it carries no replay protection.

Three URI forms are tried against the same secret, in this order: the public origin rebuilt from
`x-forwarded-proto` + `x-forwarded-host` (falling back to `Host`), then `pathname + search`, then
the URL the runtime reports. This matters — `req.url` is *not* the URL HubSpot signed: locally it
reads `http://localhost:3011/…` regardless of the `Host` header, and on Vercel it is an internal
origin. The forwarded reconstruction is what matches in production.

Delivery flow: verify signature → keep events whose `subscriptionType` starts with `contact.` →
`GET /crm/v3/objects/contacts/{objectId}?properties=phone,email[,HUBSPOT_CONSENT_PROPERTY]` →
`handleHubSpotWebhook` (in-process gate + evidence seal) → `PATCH` the verdict back as
`verifyone_status`, `verifyone_reason`, `verifyone_evidence_id`.

Before enabling it:

1. Create those three **contact properties** in HubSpot, or the PATCH writes nowhere.
2. The gate needs registries loaded (see *Compliance gate*) — with `fail_closed` and no
   `.data/dnc-us.txt`, every contact comes back `DENY` / `REGISTRY_UNAVAILABLE`.
3. Consent is **never** inferred from a contact existing. Without `HUBSPOT_CONSENT_PROPERTY` the
   route reports `consent: {declared:false, type:'none'}`, so the gate has no consent on file and
   denies AI-voice dialing. That is the correct answer for an ungated list, not a bug.
4. `HUBSPOT_TOKEN` needs CRM read **and** write scopes on contacts.

Response codes: `200` for anything permanent (non-contact events, unknown contact, no phone,
unconfigured token) so HubSpot stops redelivering; `502` only when *every* event failed
transiently (HubSpot 5xx/429/network), which is the case worth retrying. `401` on any signature
failure, `429` past 120 requests per source IP. This path is **not metered** — it does not deduct
credits, so treat webhook volume as unbilled usage until credit accounting is wired in.

## Audit chain integrity

Each sealed record stores `prev_hash` (the hash of the previous record) and its own
`record_hash`, so any edit to the ledger is detectable. That also means a **mis-ordered
append looks exactly like tampering** — `verifyChain` reports `valid: false`.

`sealEvidence()` assigns `prev_hash` from an in-memory tail and only then appends. Because
`fs.promises` dispatches each append onto the thread pool independently, concurrent seals
could reach the file in the opposite order to the one they were chained in.
`POST /api/v1/gate/batch` pools 20 concurrent seals, so a single campaign scrub call makes
this routine, not exotic. Reproduced against the real route: 40 parallel gate calls plus a
40-item batch produced **78 link breaks in 81 rows**; serialized, the same burst produced
120 rows with the chain valid.

[lib/audit-store.ts:116](../lib/audit-store.ts) now runs the assign-hash-then-append step
through a one-at-a-time promise queue and advances the tail only after the append is
durable. A size probe re-adopts the disk tail when another process has written the file.

Two known limits, both deliberate:

- **One process per ledger.** The queue is per-Node-instance. Two servers appending to the
  same `audit.jsonl` still race — the chain will *detect* it, which is the point. Use
  Postgres for multi-instance writes.
- **Postgres chains are not serialized or verified.** `verifyChain()` only reads the file,
  and `persistGateAuditRow()` stamps `prev_hash` from the same in-memory tail, so on
  serverless each lambda starts at genesis. A real DB chain needs a transaction that locks
  the tail row (`SELECT … FOR UPDATE` on the highest `createdAt`) before hashing. Not done
  here — it needs a schema decision, not a bug fix.

### Verify it

```bash
node scripts/chain-audit.mjs                             # every defect, not just the first
node scripts/chain-concurrency.mjs --base http://127.0.0.1:3007 --n 40   # exit 0 = holds
```

`chain-audit.mjs` exists because `GET /api/v1/gate/audit/chain` halts at the first break and
hides everything after it.

### Pre-existing damage in the current `.data/audit.jsonl`

Left in place on purpose — deleting rows would destroy the ledger. Rows 23, 24 and 25
(all stamped `2026-11-01T02:59:47.179Z / .183Z / .184Z`) are the race, not tampering. Every
`record_hash` still recomputes correctly; only their `prev_hash` links sit in the wrong file
order, so `verifyChain` reports `broken_at: ev_48dad95abe6ef9f986`.

They are recoverable **without modifying any row**, by rewriting those three lines in
`created_at` order:

```
ev_880cec5d17d06387aa -> ev_48dad95abe6ef9f986 -> ev_f5fe860767ae25e76a
```

Row 22's hash chains into `ev_880…`, whose hash chains into `ev_48da…`, then `ev_f5fe…`,
which already links correctly to row 26. Reordering a tamper-evident ledger is a decision for
whoever owns the record, so it has **not** been done here.

## Smoke test after deploying

Use [`./smoke.sh`](./smoke.sh) — it runs every check below, asserts on the answers, and
exits non-zero on failure. It needs only `curl` and `node`.

```bash
BASE=https://your-app.vercel.app CRON_SECRET=whsec_... ./docs/smoke.sh
```

Manual equivalents:

```bash
BASE=https://yourdomain.vercel.app
curl -s $BASE/api/v1/registry-health   # shield_ready + per-registry record counts (build-cached)
curl -s $BASE/api/billing/plans        # configured: true once DODO_* set
curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'
curl -s -X POST $BASE/api/v1/gate/phone -H 'Content-Type: application/json' \
  -d '{"phone":"+14155552120","channel":"voice","consent":{"declared":true,"type":"express_written"}}'
curl -s $BASE/api/v1/gate/audit/chain  # hash-chain integrity of sealed records
curl -s -X POST $BASE/api/cron/sync-registries -H "x-cron-secret: $CRON_SECRET"
```

Read `audit.persistence` in the gate response, not just the status code: `postgres` is
correct, `memory` means the audit trail dies with the invocation. Expect the **first**
gate call after a deploy or a registry refresh to run roughly 10x slower than steady
state — `maybeReload()` parses both `.data` files inline (measured 119 ms cold vs 8 ms
warm). `smoke.sh` issues a throwaway call first so the latency assertion tests the SLA.

The gate response carries an `evidence_id`; the sealed record is public at
`GET /api/v1/gate/audit/{evidence_id}`. Bulk CSV export at
`GET /api/v1/gate/audit/export` requires a Bearer key **and** a paid plan
(`FREE` → `403 export_requires_paid_plan`).
