# Compliance registry files (not committed — load on server / volume)

## Federal DNC (required for production shield)
1. Register at https://telemarketing.donotcall.gov
2. Download the full national file
3. Save as `dnc-us.txt` — one 10-digit US number per line

## Litigator trap list (required for production shield)
1. Export from your TCPA litigator vendor (e.g. DNC.com scrub)
2. Save as `litigators.txt` — one 10-digit number per line
3. Refresh weekly (cron: POST /api/cron/sync-registries with x-cron-secret)

## Verify
GET /api/v1/registry-health
