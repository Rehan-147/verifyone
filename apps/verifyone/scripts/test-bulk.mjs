const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
async function readJson(response) {
  return response.json().catch(() => ({}));
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\r' || char === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      if (char === '\r' && text[i + 1] === '\n') i += 1;
    } else field += char;
  }
  if (row.length || field.length) { row.push(field); rows.push(row); }
  return rows;
}
async function signup() {
  const response = await fetch(`${base}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `test+bulk-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com` }),
  });
  const body = await readJson(response);
  if (!body.api_key) throw new Error(`signup failed (${response.status})`);
  return body.api_key;
}
async function uploadCsv(key, csv) {
  return fetch(`${base}/api/v1/bulk/jobs`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'text/csv' }, body: csv,
  });
}
async function continueUntilComplete(key, jobId) {
  let summary;
  for (let i = 0; i < 20; i += 1) {
    const response = await fetch(`${base}/api/v1/bulk/jobs/${jobId}`, { headers: { Authorization: `Bearer ${key}` } });
    summary = await readJson(response);
    if (summary.status === 'completed' || summary.status === 'paused_insufficient_credits' || summary.status === 'failed') return summary;
    const continued = await fetch(`${base}/api/v1/bulk/jobs/${jobId}/continue`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } });
    summary = await readJson(continued);
  }
  return summary;
}

const apiKey = await signup();
const lines = [['phone', 'consent_type', 'notes'].map(csvCell).join(',')];
for (let i = 0; i < 50; i += 1) {
  const suffix = `01${String(i).padStart(2, '0')}`;
  const consent = i % 3 === 0 ? 'express_written' : i % 3 === 1 ? 'ebr' : 'none';
  const notes = i === 0 ? 'priority, existing customer' : i === 1 ? '=SUM(1,1)' : `lead ${i}`;
  lines.push([`+1 (212) 555-${suffix}`, consent, notes].map(csvCell).join(','));
}
for (let i = 0; i < 5; i += 1) lines.push([`not-a-phone-${i}`, 'none', `invalid ${i}`].map(csvCell).join(','));
for (let i = 0; i < 5; i += 1) lines.push([`+1 (212) 555-01${String(i).padStart(2, '0')}`, 'express_written', `duplicate ${i}`].map(csvCell).join(','));
const csv = `${lines.join('\r\n')}\r\n`;

const uploaded = await uploadCsv(apiKey, csv);
const created = await readJson(uploaded);
check('60-row CSV job created', uploaded.status === 201 && created.job_id && created.total_rows === 60);
if (!created.job_id) process.exit(1);

const summary = await continueUntilComplete(apiKey, created.job_id);
check('job completes', summary.status === 'completed', `status=${summary.status}`);
check('unique + invalid + duplicates equals total', summary.unique_rows + summary.invalid_rows + summary.duplicate_rows === summary.total_rows && summary.total_rows === 60);
const screened = Object.values(summary.summary?.by_decision || {}).reduce((sum, value) => sum + value, 0);
check('credits equal screened unique shield rows', summary.credits_charged === screened && screened === summary.unique_rows, `credits=${summary.credits_charged}, screened=${screened}`);

const resultResponse = await fetch(`${base}/api/v1/bulk/jobs/${created.job_id}/results.csv`, { headers: { Authorization: `Bearer ${apiKey}` } });
const resultText = await resultResponse.text();
const resultRows = parseCsv(resultText);
const resultHeader = resultRows[0] || [];
const statusColumn = resultHeader.indexOf('row_status');
const evidenceColumn = resultHeader.indexOf('evidence_id');
const notesColumn = resultHeader.indexOf('notes');
const everyDoneHasEvidence = resultRows.slice(1).every((row) => row[statusColumn] !== 'done' || !!row[evidenceColumn]);
check('results CSV has 60 data rows and evidence for every done row', resultResponse.ok && resultRows.length === 61 && everyDoneHasEvidence);
check('quoted comma round-trips', resultRows.some((row) => row[notesColumn] === 'priority, existing customer'));
check('formula cell is neutralized', resultRows.some((row) => row[notesColumn] === "'=SUM(1,1)"));

const reportResponse = await fetch(`${base}/api/v1/bulk/jobs/${created.job_id}/report`, { headers: { Authorization: `Bearer ${apiKey}` } });
const report = await readJson(reportResponse);
check('report totals match job', reportResponse.ok && report.totals?.rows === 60 && report.totals?.unique === summary.unique_rows && report.totals?.invalid === 5 && report.totals?.duplicates === 5 && report.totals?.screened === screened);
check('completed dev-mock job stores warning and screening snapshot', reportResponse.ok && !!report.data_warning && report.simulated_data === true && JSON.stringify(report.screened_with) === JSON.stringify(report.data_sources));
const reportAgainResponse = await fetch(`${base}/api/v1/bulk/jobs/${created.job_id}/report`, { headers: { Authorization: `Bearer ${apiKey}` } });
const reportAgain = await readJson(reportAgainResponse);
check('stored source snapshot is stable across report reads', reportAgainResponse.ok && JSON.stringify(reportAgain.data_sources) === JSON.stringify(report.data_sources) && JSON.stringify(reportAgain.screened_with) === JSON.stringify(report.screened_with));
const htmlResponse = await fetch(`${base}/api/v1/bulk/jobs/${created.job_id}/report?format=html`, { headers: { Authorization: `Bearer ${apiKey}` } });
const html = await htmlResponse.text();
check('print report has disclaimer and simulated-data banner', htmlResponse.ok && html.includes('Compliance tooling, not legal advice.') && html.includes('Some checks used simulated or unavailable data'));
check('report does not expose phone numbers', !JSON.stringify(report).includes('+1212555'));

const otherKey = await signup();
const wrongOwner = await fetch(`${base}/api/v1/bulk/jobs/${created.job_id}`, { headers: { Authorization: `Bearer ${otherKey}` } });
check('another account receives 404', wrongOwner.status === 404);

const concurrencyRows = Array.from({ length: 300 }, (_, i) => ({
  phone: `+1212555${String(2000 + i).padStart(4, '0')}`,
  consent_type: 'express_written',
}));
const concurrencyCreate = await fetch(`${base}/api/v1/bulk/jobs`, {
  method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rows: concurrencyRows }),
});
const concurrentJob = await readJson(concurrencyCreate);
check('300-row concurrency job created', concurrencyCreate.status === 201 && concurrentJob.job_id);
if (concurrentJob.job_id) {
  await Promise.all(Array.from({ length: 5 }, () => fetch(`${base}/api/v1/bulk/jobs/${concurrentJob.job_id}/continue`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` },
  })));
  const final = await continueUntilComplete(apiKey, concurrentJob.job_id);
  check('parallel continues do not double process or charge', final.status === 'completed' && final.unique_rows === 300 && final.credits_charged === 300 && final.processed_rows === 300, `status=${final.status}, credits=${final.credits_charged}`);
}

if (checks.some((item) => !item.ok)) process.exitCode = 1;
