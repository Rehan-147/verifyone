# VerifyOne → $100k MRR: implementation prompts

Each prompt below is self-contained: paste it into a fresh Claude Code / Codex
session at the repo root. Run them **in order within a phase**; phases build on
each other. Every prompt inherits the house rules — repeat them if your agent
doesn't read `CLAUDE.md`:

> House rules: fail-closed compliance defaults (missing data in production =
> BLOCK/REVIEW, never ALLOW). `lib/plans.ts` is the only source of plans,
> prices and credits. Never claim an untested integration in UI copy. Edit
> canonical files only — never the `*_1` / `*_2` twin files. Update README §7
> (Next Tasks) when a task lands. Run `npx tsc --noEmit` before finishing.

Revenue mix this roadmap targets: **~6 platform/white-label accounts × ~$8k +
~150 agencies × ~$350 ≈ $100k MRR.**

---

## Phase 0 — Make it safe to take money (do before any customer)

### P0.1 — Close the free-tier quota bypass and fix 402 CORS

```
In app/api/v1/gate/phone/route.ts the free-tier quota key is `apiKey || 'ip:' + ip`.
If a caller sends an Authorization/x-api-key header that does not authenticate,
the route falls through to the free tier keyed by that arbitrary string — rotating
fake keys gives unlimited free checks. Fix it:

1. If a key header is present but authenticate() returns null, respond 401
   { error: 'invalid_api_key' } with CORS headers. Never fall back to free tier.
2. Free tier is keyed only by client IP. Derive IP from the FIRST entry of
   x-forwarded-for (trimmed), falling back to x-real-ip, then 'local'. Put this in
   a shared helper `clientIp(req)` in lib/auth.ts and use it in every route that
   currently reads x-forwarded-for (grep for it, canonical files only).
3. The 402 insufficient_credits response must include the CORS headers.
4. Apply the same invalid-key rule to every metered route that uses
   checkAndBumpQuota or authenticate (grep both). Webhook routes that HOLD on
   errors keep their HOLD behaviour.
5. Add a small test script scripts/test-quota.mjs that hits a local dev server
   with 3 fake keys and asserts 401s.
Done when: fake keys get 401, valid keys meter, anonymous traffic is IP-quota'd.
```

### P0.2 — Charge credits only for completed decisions, and reserve the full cost

```
In the gate routes (phone, email, batch, and the vapi/retell/hubspot/lead-intake
webhooks), credits are deducted before runPhoneGate runs, and creditsAvailable()
only checks balance > 0 — a 5-credit full_stack call runs with 1 credit left.

1. Change creditsAvailable(acc, cost) to require acc.credits >= cost. Update all
   callers to pass the bundle cost (gateBundleCredits).
2. Meter AFTER the decision is produced, and do not charge when the result reason
   is gate_unavailable_fail_closed or fail_open_gate_unavailable (our failure, not
   theirs). Still seal evidence for those.
3. In lib/auth-db.ts make dbMeter atomic: a single UPDATE ... SET credits =
   credits - $cost WHERE id = $id AND credits >= $cost RETURNING credits. If no row
   updated, treat as insufficient (the decision is still returned — they already
   got it — but log a ledger row 'meter_race').
4. Write every meter event to the CreditLedger table (prisma/schema.prisma) when
   the DB path is active.
Done when: tsc passes and a manual test shows full_stack refuses at 4 credits.
```

### P0.3 — Stop tracking private data in git

```
.data/keys.json, payments.jsonl, audit.jsonl, usage.json, tickets.json, cache.json
and .data/screenshots/** are committed. Customer emails are in them.

1. Add `.data/` to .gitignore, keeping only an empty .data/.gitkeep and
   .data/REGISTRIES.md tracked (use negation rules).
2. `git rm -r --cached` the data files (do NOT delete them from disk).
3. Add a section to DEPLOY.md: "History scrub" explaining that the files still
   exist in git history and how to purge with git filter-repo if the repo is or
   becomes public. Do not run the history rewrite yourself.
4. Also untrack dev.log and tsconfig.tsbuildinfo if tracked.
Do not commit — leave the changes staged and summarise them.
```

### P0.4 — Move persistence to Postgres (serverless-safe)

```
README §7 task #3. The JSONL/JSON file stores in lib/audit-store.ts and lib/auth.ts
are not safe on Vercel (ephemeral FS, multiple instances). lib/audit-db.ts and
lib/auth-db.ts already have a DB path behind dbReady().

1. Make the DB path mandatory when NODE_ENV=production: if DATABASE_URL is missing
   in production, gate routes return a fail-closed block with reason
   'persistence_unavailable' (never seal to a temp file in prod).
2. Add Prisma models (or extend existing ones) for: FreeTierUsage (ip, month,
   count), Ticket, RateLimitWindow is NOT needed — instead move rateLimit to
   Upstash Redis when UPSTASH_REDIS_REST_URL is set, in-memory otherwise.
3. Audit chain in Postgres: serialize appends with a single-row "chain_tail" table
   and SELECT ... FOR UPDATE inside a transaction so prev_hash is never forked
   under concurrency. Port scripts/chain-concurrency.mjs to run against the DB path.
4. Write scripts/migrate-file-to-db.mjs that imports existing .data JSONL into the
   DB preserving hashes, and verifies the chain after import.
Done when: `/api/v1/gate/audit/chain` verifies clean after 200 concurrent gate
calls against the DB path.
```

### P0.5 — Email OTP before issuing API keys

```
app/api/auth/signup/route.ts issues a vk_live_ key to any email without
verification. Implement:
1. POST /api/auth/signup { email } → creates a pending signup, emails a 6-digit
   code (Resend if RESEND_API_KEY set; in dev, log the code to the console).
   Codes are stored hashed, expire in 10 min, max 5 attempts.
2. POST /api/auth/verify { email, code } → issues the key (shown once) via
   createAccount.
3. Rate-limit both by IP and by email. Block disposable-email domains using the
   existing email validator in lib/validators.ts if it has a list; otherwise add
   a small list.
4. Update the signup UI and /for-agents docs to the two-step flow.
```

### P0.6 — Legal guardrails

```
Add a "Compliance controls are not legal advice" disclaimer:
1. Footer (components/Footer.tsx) one-liner linking /legal/compliance-disclaimer.
2. Every gate API response gets a constant `disclaimer` field via
   formatPublicGateResponse in lib/gate-contract.ts.
3. The evidence export (app/api/v1/gate/audit/[id]/export) HTML footer states it.
4. Signup/checkout require ticking "I accept the Terms" — record accepted_at and
   terms version on the account.
Mark the legal page copy in lib/data/legal.ts with a visible
"Pending counsel review" banner until an env flag LEGAL_REVIEWED=true is set.
```

---

## Phase 1 — Real data (what buyers actually pay for)

### P1.1 — Litigator feed: vendor adapter with provenance

```
.data/litigators.txt is empty, so litigator scrub is a shell. Build a pluggable
litigator source in lib/registry-ingest.ts + lib/compliance-cache.ts:

1. Adapter interface LitigatorSource { id, vendor, fetchAll(): AsyncIterable<string>,
   lookup?(phone): Promise<{hit, list?}> } with two implementations:
   (a) bulk file download from LITIGATOR_REGISTRY_URL (CSV or newline E.164),
   (b) real-time per-number API (LITIGATOR_API_URL + LITIGATOR_API_KEY), called
       only on the full_stack profile, cached 24h.
2. Store the set in Postgres or a compact sorted binary file — NOT an in-memory
   JS Set of strings (scale). Lookup must stay under 5ms p99.
3. Receipt in data_sources: vendor name, list version/date, record count.
4. Production with no litigator source loaded = shield NOT ready → fail-closed
   block reason 'litigator_source_unavailable' (check evaluateShieldReadiness in
   lib/compliance-policy.ts and keep it consistent).
5. /api/v1/registry-health shows record count + age; stale > 7 days = degraded.
```

### P1.2 — Scale-safe DNC storage

```
FTC DNC is held as a JS Set loaded from .data/dnc-us.txt (lib/compliance-cache.ts).
Full registry = hundreds of millions of numbers; this will not fit.
1. Store DNC numbers as 64-bit integers in Postgres (BIGINT primary key, one table
   per registry: dnc_us, dnc_ca) and/or a Bloom filter in memory + DB confirm.
2. Ingest via COPY in batches from the existing area-code-scoped downloads; track
   per-area-code last_synced_at.
3. Only area codes the customer dials need to be loaded — add DNC_AREA_CODES
   auto-expansion from the last 30 days of gate traffic.
4. Lookup p99 < 10ms. Keep receipts ftc_registry_cache / crtc_dncl_cache.
```

### P1.3 — Calling-hours: no silent New York fallback

```
lib/gate.ts callingHoursFor() assumes America/New_York for unknown NPAs and still
ALLOWs. Fail-closed rule says unknown must not silently allow.
1. Remove the junk '917x' entry in NPA_TZ. Complete the NPA map for all active
   US/CA area codes (source: NANPA public data; put the map in lib/data/npa-tz.ts).
2. For split-timezone NPAs, evaluate the window against BOTH zones and only allow
   if both are inside 08:00–21:00.
3. Unknown NPA → decision 'review', reason 'timezone_unknown'.
4. Add state-level stricter windows (e.g. FL/OK 8am–8pm and others under state
   mini-TCPA laws) as a data table lib/data/state-calling-rules.ts with a
   `source` and `last_reviewed` field per row. Map NPA→state.
5. Tests: a TZ matrix script scripts/test-calling-hours.mjs.
```

### P1.4 — State DNC lists (phase 2 data)

```
Add state DNC support behind the same adapter shape as P1.1. Start with a vendor
bundle via STATE_DNC_API_URL/KEY (per-number lookup, full_stack only, cached).
Add receipt id 'state_dnc'. Without config: receipt status 'missing' and do NOT
claim state DNC coverage anywhere in UI copy (grep pages for "state DNC").
```

---

## Phase 2 — Pricing & billing for the revenue mix

### P2.1 — New plan ladder in lib/plans.ts

```
Edit lib/plans.ts only (single source), then make every consumer render from it.
New ladder:
- FREE: 500 shield checks/mo (existing quota), no card.
- LITE: $99/mo, 5,000 credits — "for solo AI voice builders" (entry tier).
- STARTER $299 / 30k, GROWTH $899 / 120k, PRO $2,399 / 400k (unchanged).
- PLATFORM: custom — monthly minimum (default $3,000) + wholesale per-check
  price (default $0.004 shield, $0.02 full_stack), white-label, sub-accounts.
Add fields: overageUsdPerCredit (LITE 0.02, STARTER 0.012, GROWTH 0.009,
PRO 0.007), selfServe (true except PLATFORM), and an `annualDiscountPct` of 15.
Update: components/Pricing.tsx, app/pricing/page.tsx, components/Dashboard.tsx
Billing tab, lib/dodo.ts (DODO_PRODUCT_LITE), app/api/billing/plans,
normalizePlanKey, .env.example, DEPLOY.md §6b (Dodo products to create).
PLATFORM shows "Talk to us" → /contact form (P4.3), not checkout.
```

### P2.2 — Overage metering instead of hard stop

```
Paid plans currently hard-stop at 0 credits (402). For voice campaigns a mid-day
hard stop is churn. Implement opt-in overage:
1. Account field overage_enabled (default true for paid plans, false for FREE/LITE
   until a card is on file) and overage_cap_usd (default 2× plan price).
2. When credits hit 0 and overage is enabled and under cap, continue serving and
   record overage units in CreditLedger.
3. Report usage to Dodo's usage-based billing at period end (lib/dodo.ts:
   reportUsage). If Dodo usage billing is not configured, keep the hard stop —
   fail closed on billing too.
4. /api/v1/account/usage shows overage units, $ accrued, and cap.
5. Email at 80% and 100% of credits and at 80% of overage cap.
```

### P2.3 — Setup service checkout

```
Add a one-time "Done-for-you compliance setup" product ($1,500, configurable in
lib/plans.ts as SETUP_SERVICE). Dodo one-time checkout via a new route
/api/billing/setup-checkout. After payment, the dodo webhook writes a row to a
SetupOrder table and emails the founder with the customer's intake answers
(platform: vapi|retell|ghl|custom, monthly call volume, has consent capture y/n).
Add a card on /pricing under the plans.
```

---

## Phase 3 — Lead magnet: the free list scan

### P3.1 — Real bulk CSV screening (replace the stub)

```
app/api/bulk/route.ts is a stub (returns a random batch id, does nothing).
Build real bulk screening:
1. POST /api/bulk (multipart CSV or JSON rows) → creates a BulkJob, returns
   batch_id. Columns auto-detected: phone (required), consent_type, state, name.
2. Process in background (Vercel: chunked via a queue such as Upstash QStash; dev:
   in-process). 20 concurrent gate evaluations, each sealed as evidence.
3. GET /api/bulk/[id] → progress + summary counts by decision and reason.
4. GET /api/bulk/[id]/download → CSV of original rows + decision, reason,
   evidence_id.
5. Charge per row at the shield bundle rate; refuse jobs larger than remaining
   credits (+ overage cap) up front.
Wire the Dashboard "Bulk CSV" tab to it.
```

### P3.2 — Public "TCPA risk scan" (no signup)

```
New page /scan: upload a CSV (max 1,000 rows, rate-limited per IP: 1 scan/day).
Runs the shield profile with dev mocks OFF. Shows an aggregate report only:
% litigator hits, % DNC listed, % likely mobile without written consent,
% outside calling hours right now, estimated exposure = risky rows × $500–$1,500.
Per-row results are hidden behind email signup ("Email me the full report") —
which triggers the OTP signup from P0.5 and attaches the result file.
Never store the uploaded raw numbers beyond 24h; state that on the page.
Link /scan from: home hero secondary CTA, every /tools/[slug] page, every
/compare/[slug] page, and the footer.
```

### P3.3 — Point existing SEO pages at the scan

```
app/tools/[slug] and app/compare/[slug] pages (data in lib/data/tools.ts and
lib/data/compare.ts) are traffic pages with no conversion path to the gate.
Add a consistent CTA block component components/ScanCTA.tsx: one sentence on
"AI voice campaigns need a pre-dial gate", button to /scan, secondary link to
/for-agents. Keep copy honest — no claims about integrations not in README §6
as implemented. Add UTM-style ?src=tools-<slug> so P5.1 analytics attributes it.
```

---

## Phase 4 — Agencies & platforms (where the MRR is)

### P4.1 — Sub-accounts (agency → client)

```
Agencies run campaigns for many clients and need per-client evidence and usage.
1. Data model: Account has many Workspaces (clients). API keys are scoped to a
   workspace. Credits pool at the account level; usage is tracked per workspace.
2. Evidence records store workspace_id; the audit export accepts the workspace's
   display name instead of the free-text `label` param (keep label for back-compat,
   still covered by the HMAC signature).
3. Dashboard: workspace switcher, create workspace, per-workspace keys, usage,
   and evidence search.
4. Per-workspace suppression list (internal_suppression check) and per-workspace
   default consent policy.
Available on GROWTH and above (gate via lib/plans.ts feature flag `workspaces`).
```

### P4.2 — White-label for platforms

```
PLATFORM plan feature: white-label.
1. Account settings: brand name, logo URL, primary colour, support email,
   custom domain for evidence pages (CNAME → evidence.<their-domain>).
2. Evidence export HTML (?format=html) and the public verify page render with the
   platform's branding and "Compliance check powered by VerifyOne" small footer
   (removable only on a `remove_attribution` flag).
3. Platform API: POST /api/v1/platform/workspaces to provision a sub-account
   programmatically for each of their end customers, returning a scoped key.
4. Wholesale metering: usage per workspace rolls up to the platform's invoice at
   the PLATFORM per-check price from lib/plans.ts.
5. Monthly usage CSV per workspace at /api/v1/platform/usage?month=YYYY-MM so the
   platform can rebill its customers.
```

### P4.3 — Platform/contact intake

```
Add /contact (or /platforms/apply) form: company, platform type (voice platform,
GHL reseller, agency, call centre), monthly outbound calls, current compliance
vendor, timeline. Store in a Lead table, email the founder, and auto-reply with a
Cal.com link (CAL_LINK env). Spam-protect with a honeypot + IP rate limit.
"PLATFORM" CTA on /pricing and /for-platforms points here.
```

### P4.4 — Consent capture as default path

```
The gate trusts customer-declared consent. Make captured consent the default:
1. app/api/webhooks/lead-intake already seals consent at form time. Return a
   consent_id. Accept consent_id in POST /api/v1/gate/phone; when present, the
   gate uses the sealed record (type, captured_at, cert) instead of the body
   claim and adds receipt 'sealed_consent'.
2. Consent freshness: consent older than CONSENT_MAX_AGE_DAYS (default 90) on
   full_stack → REVIEW 'consent_stale' unless RNDB says not reassigned.
3. Evidence shows "consent: sealed at intake (consent_id …)" vs
   "consent: declared at dial time" — make the difference visible in the export.
4. Provide an embeddable JS snippet /consent.js agencies drop on lead forms:
   captures the TCPA disclosure text shown, timestamp, page URL, IP, user agent,
   and posts to lead-intake with the workspace key (publishable key type
   pk_live_…, intake-only scope).
```

### P4.5 — Copy-paste integration templates

```
Agencies copy what works. For each platform in README §6 marked implemented
(Vapi, Retell, MCP, HubSpot, Clay) plus generic HTTPS (n8n, Make, Zapier, GHL):
1. A docs page section in app/docs with a one-click copyable config
   (Vapi/Retell REST gate-then-dial scheduler examples, inbound screening beta
   rejects invalid numbers, flags loaded litigators, and skips outbound DNC/consent rules;
   notes, n8n workflow JSON export, Make blueprint JSON, GHL webhook action).
2. Put the importable files in public/templates/ and link them.
3. Each template must have been run end-to-end against a local dev server — add
   a "Last tested: <date>" line; templates not tested are labelled "untested".
```

---

## Phase 5 — Operate solo

### P5.1 — Funnel analytics

```
Add privacy-friendly analytics (Plausible or PostHog via env; no-op if unset).
Track events: scan_started, scan_completed, scan_email_captured, signup_otp_sent,
signup_verified, first_gate_call, checkout_started, plan_activated,
contact_submitted. Server-side events for API milestones (first_gate_call,
plan_activated) keyed by account id, no phone numbers or emails in event props.
Add an internal /admin page (ADMIN_EMAILS env allow-list) with a funnel table,
MRR (sum of active plans from lib/plans.ts prices + platform minimums), and
accounts at >80% credit usage (upsell list).
```

### P5.2 — Lifecycle emails

```
Using Resend (RESEND_API_KEY), send transactional + lifecycle emails:
- signup: key issued + 3-line quickstart (curl) + link to templates
- no gate call 48h after signup: "stuck? here's the Vapi template"
- first DENY: "VerifyOne just blocked a risky call — here's the evidence"
  (link to export) — this is the aha moment
- 80%/100% credits, overage cap (from P2.2)
- weekly digest (app/api/cron/digest exists — make it real): calls gated,
  decisions by reason, estimated exposure avoided
Unsubscribe link for non-transactional mail.
```

### P5.3 — Reliability for platform deals

```
Platforms won't sign without these:
1. /status page backed by real checks: gate p50/p99 latency (last 1h), error rate,
   registry freshness (from registry-health). Not hard-coded.
2. Structured logging (pino) with request_id on every gate response header
   (x-request-id) and in the evidence record.
3. Alerting: Sentry (SENTRY_DSN) + a cron that pings /api/v1/gate/phone with a
   synthetic number every 5 min and alerts on non-200 or p99 > budget.
4. Idempotency: accept Idempotency-Key header on gate + bulk; same key within 24h
   returns the same evidence_id and does not charge twice.
```

### P5.4 — CI and gate tests

```
README §7 task #8.
1. GitHub Actions: npm ci, npx tsc --noEmit, next lint, and a test runner (vitest).
2. Gate tests: decision ladder order, fail-closed when sources missing in
   production mode, consent sufficiency per line type, TZ matrix (from P1.3),
   credit reservation (P0.2), invalid-key 401 (P0.1), audit chain under
   concurrency.
3. Delete all *_1 / *_2 twin files (list them first, confirm none are imported:
   grep for each basename with _1/_2 in import paths) and the duplicate READMEs
   (README_1, README_2, README_FINAL, README_INTEGRATIONS_1/_2) after merging any
   unique content into README.md.
4. Move .data/screenshots tooling scripts out of the repo or into scripts/dev/.
```

---

## Suggested order (solo, ~12–18 months)

| When | Prompts | Revenue unlock |
|---|---|---|
| Weeks 1–3 | P0.1 → P0.6 | Safe to charge anyone |
| Weeks 3–6 | P1.1, P1.3, P2.1, P2.3 | Real litigator scrub, $99 entry, setup cash |
| Weeks 6–10 | P3.1, P3.2, P3.3, P5.2 | Free scan lead magnet → agency signups |
| Months 3–6 | P4.1, P4.4, P4.5, P5.1, P1.2 | Agencies at $299–$899 |
| Months 6–12 | P4.2, P4.3, P5.3, P2.2, P1.4 | Platform deals at $3–10k minimums |
| Ongoing | P5.4 | Keeps it solo-maintainable |

Not code, but blocking: litigator data contract with resale rights (P1.1),
counsel review of legal pages (P0.6), E&O insurance before PLATFORM deals,
Dodo products created for the new ladder (P2.1).
