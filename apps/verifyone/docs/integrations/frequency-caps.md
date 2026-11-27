# Call-frequency caps

VerifyOne limits how often **your account** can call the **same number** in a rolling 24 hours.

## What is enforced

| Limit | Value | Source | Can you raise it? |
|---|---|---|---|
| Florida state rule | 3 calls per 24 h | Fla. Stat. § 501.616(6)(b) ("more than three commercial telephone solicitation phone calls … over a 24-hour period on the same subject matter or issue") | No |
| Your account cap (optional) | 1–50 calls per 24 h | Set by an org admin in `/dashboard/settings` or `PUT /api/v1/settings/frequency` | Yes (or set `null` for none) |

The stricter limit wins. We count every call your account makes to the number, across all
campaigns — stricter than the statute's "same subject matter" wording, because we cannot tell
subjects apart. State rules are marked **pending counsel review**; Oklahoma and Maryland have
similar laws but are not enforced until verified from an official source.

## What counts as an attempt

| Request | Counts? |
|---|---|
| `POST /api/v1/gate/phone` returning ALLOW | Yes, unless you send `"count_attempt": false` (a pre-check) |
| MCP `check_call_allowed` returning ALLOW | Yes, unless `count_attempt: false` |
| `POST /api/v1/dial/{vapi|retell}` placing a call | Yes; released again if the platform rejects the call |
| Bulk list audits, `/api/v1/gate/batch` | Never (they still report a cap that is already reached) |
| DENY / REVIEW decisions | Never |

Reservations are atomic: concurrent requests can never push a number past its cap.

## Responses

- Limit reached → `DENY` with `STATE_FREQUENCY_CAP` (state law) or `FREQUENCY_CAP` (your cap).
  These are never overridable through the review queue.
- The attempt ledger is unavailable → `REVIEW` with `FREQUENCY_CHECK_UNAVAILABLE` and
  `retry_after_seconds` (never a silent ALLOW).
- `checks.frequency` shows `attempts_24h` (before this call), `limit`, `source`
  (`state:FL` or `org`), `citation`, and `attempt_recorded`.

## API

```http
GET /api/v1/settings/frequency          Authorization: Bearer vk_live_…
PUT /api/v1/settings/frequency          { "call_cap_24h": 3 }   // or null
```

Organization accounts only (`400 org_account_required` otherwise).
