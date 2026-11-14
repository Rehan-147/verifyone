# VerifyOne app context

Read `README.md` for the product contract, route flows, data source state, and current tasks.

VerifyOne is a pre-dial compliance gate for AI voice agents (Vapi, Retell, Bland, custom stacks). It returns `ALLOW | REVIEW | DENY` plus a sealed, hash-chained audit record. It is not a voice agent and not a one-lookup clone.

Non-negotiable when editing code:
- fail-closed compliance defaults (missing data in production = BLOCK, never allow)
- `lib/plans.ts` is the single source for plans, prices, and credits
- never claim untested integrations in UI copy
- edit canonical files only; do not recreate duplicate `_1`/`_2` scaffolds
- current app task list lives in `README.md` §7