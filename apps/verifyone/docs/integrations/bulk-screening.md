# Bulk list screening

Bulk screening accepts an authenticated CSV upload or JSON rows, runs each unique valid phone
through the same fail-closed outbound gate as `POST /api/v1/gate/phone`, and seals an evidence
record for each decision. Invalid numbers and duplicates are returned as row statuses without a
gate run or charge. Only rows with a gate decision and evidence ID are marked `done`.

## Upload a list

CSV upload:

```bash
curl -X POST https://YOUR_DOMAIN/api/v1/bulk/jobs \
  -H "Authorization: Bearer $VERIFYONE_API_KEY" \
  -H "Content-Type: text/csv" \
  --data-binary @leads.csv
```

Multipart uploads use a `file` field. JSON uploads use `{ "rows": [{ "phone": "...", "consent_type": "express_written" }] }`.
The phone column is detected from `phone`, `phone_number`, `mobile`, `number`, `to`, `to_number`, or `cell`.
Consent is read from `consent_type` or `consent`; accepted values are `express_written`, `ebr`, and `none`.
Other consent values are treated as `none`.

The response returns a `job_id` plus `poll_url`, `results_url`, and `report_url`. The first chunk
is processed inline; if rows remain pending, ask the owner to continue the job:

```bash
curl -X POST https://YOUR_DOMAIN/api/v1/bulk/jobs/bj_JOB_ID/continue \
  -H "Authorization: Bearer $VERIFYONE_API_KEY"
```

Poll `GET /api/v1/bulk/jobs/bj_JOB_ID` for `pending`, `running`, `paused_insufficient_credits`,
`completed`, or `failed`. A scheduled worker at `POST /api/cron/bulk-worker` processes up to five
pending/running jobs per invocation and purges expired jobs. Configure `CRON_SECRET` and send it
as `x-cron-secret`.

## Download results and report

`GET /api/v1/bulk/jobs/bj_JOB_ID/results.csv` downloads the original columns plus:

| Column | Meaning |
|---|---|
| `phone_e164` | Normalized valid phone; blank for invalid rows |
| `row_status` | `done`, `invalid`, or `duplicate` |
| `decision` | `ALLOW`, `REVIEW`, or `DENY` for screened rows |
| `reason` | Public reason code, `INVALID_NUMBER`, or `DUPLICATE` |
| `risk_score` | Gate score for screened rows |
| `evidence_id` | Sealed evidence record for screened rows |

Cells beginning with `=`, `+`, `-`, or `@` are prefixed to prevent spreadsheet formula execution.

`GET /api/v1/bulk/jobs/bj_JOB_ID/report` returns aggregate JSON. Add `?format=html` for a
printable A4/Letter report. The report includes counts and an illustrative statutory exposure
range; it does not include phone numbers and is not legal advice. If checks used simulated or
unavailable sources, the report displays a prominent warning that it is not valid for compliance
decisions.

## Credits and retention

The job is admitted only when the account has enough credits for all unique valid rows at the
selected profile rate (`ai_outbound_shield` is 1 credit per row; `full_stack` is 5). Each chunk is
metered after decisions are produced. Gate-unavailable fail-closed results are not charged.
Insufficient balance pauses the job; after adding credits, the owner can call `/continue` again.

The row and evidence reference retention is `BULK_RETENTION_DAYS` (default 30). Upload size is
limited by `BULK_MAX_ROWS` (default 10,000). In production, both settings require Postgres-backed
persistence; local file persistence is development-only.
