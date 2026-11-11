# VerifyOne — agent context (Claude Code)

**Read `README.md` first — it is the complete, canonical context for this repo.**

TL;DR — VerifyOne is a **pre-dial compliance gate for AI voice agents**
(Vapi, Retell, Bland, custom stacks). One HTTPS call before every outbound dial
returns `ALLOW | REVIEW | DENY` plus a sealed, hash-chained audit record
(evidence_id). Checks: FTC DNC, FCC reassigned-number (RNDB), consent type
(AI voice = prior express written), calling hours, litigator scrub, carrier
status, internal suppression. NOT a voice agent. NOT a one-to-one-lookup clone.

Non-negotiable when editing code:
- fail-closed compliance defaults (missing data in production = BLOCK, never allow)
- `lib/plans.ts` is the single source for plans/prices/credits
- never claim untested integrations in UI copy
- edit canonical files only (`lib/gate.ts`, …) — never the `_1`/`_2` twin scaffolds
- current task list lives in `README.md` §7 (Next Tasks)
