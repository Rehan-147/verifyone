# Google Sheets × VerifyOne Gate (Apps Script, no server needed)

Scrub a sheet of phone numbers against the Pre-Dial Gate and write the decision
back as new columns. Works from a menu click.

## Setup (3 minutes)

1. Open your sheet → **Extensions → Apps Script**
2. Paste the code below
3. Set `BASE` to **your** deployment URL — `https://your-app.vercel.app`, or `http://localhost:3000`
   for a local run. Do not leave the placeholder host in place; it points at somebody else's app.
4. Optionally add your key at the top (`API_KEY = 'v1_...'`) — keyless works too (500/month)
5. Save → reload the sheet → **VerifyOne menu → Scrub gate on column A**

For per-cell checking instead of a full-column scrub, use the `=VERIFYONE()` custom function in
[`../../lib/integrations/google-sheets.js`](../../lib/integrations/google-sheets.js), which reads
`VERIFYONE_URL` / `VERIFYONE_KEY` from Script Properties.

```javascript
const BASE = 'https://your-app.vercel.app';
const API_KEY = ''; // optional: 'v1_...'

function onOpen() {
  SpreadsheetApp.getUi().createMenu('VerifyOne')
    .addItem('Scrub gate on column A', 'scrubColumnA')
    .addToUi();
}

function scrubColumnA() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const last = sheet.getLastRow();
  const phones = sheet.getRange(2, 1, last - 1, 1).getValues(); // skips header
  const out = phones.map((row) => {
    const phone = String(row[0] || '').trim();
    if (!phone) return ['', '', ''];
    const res = JSON.parse(UrlFetchApp.fetch(BASE + '/api/v1/gate/phone', {
      method: 'post',
      contentType: 'application/json',
      headers: API_KEY ? { Authorization: 'Bearer ' + API_KEY } : {},
      payload: JSON.stringify({
        phone,
        channel: 'voice',
        // No consent on file is a real answer, not a missing parameter: the gate denies
        // AI-dialed calls that need express written consent. Flip to
        // { declared: true, type: 'express_written' } only where you hold it.
        consent: { declared: false, type: 'none' },
      }),
      muteHttpExceptions: true,
    }).getContentText());
    if (res.error) return ['error', res.error, ''];
    const ch = res.checks || {};
    return [
      res.decision || '', res.reason || '',
      (ch.calling_hours && ch.calling_hours.timezone) ? ch.calling_hours.timezone : ''
    ];
  });
  sheet.getRange(2, 2, out.length, 3).setValues(out); // writes B,C,D
  SpreadsheetApp.getUi().alert('Done — decision (B), reason (C), timezone (D) written.');
}
```

## Columns written

- **B — decision**: `ALLOW` / `DENY` (dial only on ALLOW)
- **C — reason**: the public reason token — `PASS`, `ACTIVE_HLR`, `LITIGATOR_TRAP`,
  `DNC_NATIONAL_VIOLATION`, `REASSIGNED_NUMBER`, `TCPA_AI_VOICE_CONSENT`, `QUIET_HOURS`,
  `DISCONNECTED`, `INVALID_NUMBER`, `GATE_UNAVAILABLE`, `REGISTRY_UNAVAILABLE`.
  The internal snake_case token is in `reason_legacy` if you want it.
- **D — timezone**: the contact's timezone (schedule dialing windows with it)

## Notes

- `REGISTRY_UNAVAILABLE` means the deployment has no DNC/litigator registry loaded and the gate is
  fail-closed — it will not answer ALLOW on uncached traffic. Sync the registries first
  (`POST /api/cron/sync-registries`, see [../DEPLOY.md](../DEPLOY.md)).
- Apps Script quota: ~20,000 HTTP calls/day on a free Google account — batch in chunks of ≤1,500 rows
- Every checked row returns an `evidence_id` (audit trail) — add `res.evidence_id` to a column if you want it stored
