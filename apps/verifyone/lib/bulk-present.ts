import { toPublicDecision, toPublicReason } from './gate-contract';
import type { GateChecks } from './gate';
import type { BulkJob, BulkRow, BulkSnapshot } from './bulk-store';
import { buildDataSourceReceipts } from './compliance-cache';
import { encodeCsvCell } from './bulk-input';

export function publicRowDecision(row: BulkRow) {
  if (row.decision === 'allow' || row.decision === 'review' || row.decision === 'block') return toPublicDecision(row.decision);
  return null;
}

export function publicRowReason(row: BulkRow) {
  if (row.status === 'invalid') return 'INVALID_NUMBER';
  if (row.status === 'duplicate') return 'DUPLICATE';
  return row.reason ? toPublicReason(row.reason, {} as GateChecks) : '';
}

export function bulkSummary(job: BulkJob, rows: BulkRow[]) {
  const by_decision = { ALLOW: 0, REVIEW: 0, DENY: 0 };
  const by_reason: Record<string, number> = {};
  for (const row of rows) {
    const decision = publicRowDecision(row);
    if (decision) by_decision[decision] += 1;
    const reason = publicRowReason(row);
    if (reason) by_reason[reason] = (by_reason[reason] || 0) + 1;
  }
  return {
    job_id: job.id,
    status: job.status,
    total_rows: job.totalRows,
    unique_rows: job.uniqueRows,
    processed_rows: job.processedRows,
    invalid_rows: job.invalidRows,
    duplicate_rows: job.duplicateRows,
    credits_charged: job.creditsCharged,
    summary: { by_decision, by_reason },
  };
}

export function resultsCsv(snapshot: BulkSnapshot) {
  const headers = snapshot.job.columns.headers;
  const appended = ['phone_e164', 'row_status', 'decision', 'reason', 'risk_score', 'evidence_id'];
  const output = [
    [...headers, ...appended].map(encodeCsvCell).join(','),
    ...snapshot.rows.map((row) => [
      ...headers.map((header) => row.original[header]),
      row.phone,
      row.status,
      publicRowDecision(row),
      publicRowReason(row),
      row.riskScore,
      row.evidenceId,
    ].map(encodeCsvCell).join(',')),
  ];
  return `${output.join('\r\n')}\r\n`;
}

const RISK_CATEGORIES = [
  ['internal_dnc', new Set(['internal_dnc'])],
  ['litigator_hits', new Set(['litigator_list'])],
  ['dnc_listed_without_consent', new Set(['do_not_call_no_consent'])],
  ['ai_voice_consent_missing', new Set(['ai_voice_consent_required'])],
  ['reassigned', new Set(['reassigned_number_consent_required'])],
  ['disconnected', new Set(['disconnected'])],
  ['quiet_hours_now', new Set(['quiet_hours', 'state_quiet_hours'])],
  ['frequency_capped', new Set(['frequency_cap', 'state_frequency_cap'])],
] as const;

function percent(count: number, total: number) {
  return total ? Math.round((count / total) * 10_000) / 100 : 0;
}

export type ReportCostParams = {
  perCallUsd: number | null;
  perSmsUsd: number | null;
};

export function parseReportCostParams(searchParams: URLSearchParams): { ok: true; value: ReportCostParams } | { ok: false; error: string } {
  const rawCall = searchParams.get('cost_per_call');
  const rawSms = searchParams.get('cost_per_sms');

  const parseBounded = (raw: string | null, name: string): { ok: true; value: number | null } | { ok: false; error: string } => {
    if (raw === null) return { ok: true, value: null };
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, error: `invalid_${name}` };
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0 || num > 10) {
      return { ok: false, error: `invalid_${name}` };
    }
    return { ok: true, value: num };
  };

  const callParsed = parseBounded(rawCall, 'cost_per_call');
  if (!callParsed.ok) return callParsed;
  const smsParsed = parseBounded(rawSms, 'cost_per_sms');
  if (!smsParsed.ok) return smsParsed;

  if (smsParsed.value !== null && callParsed.value === null) {
    return { ok: false, error: 'cost_per_call_required_with_cost_per_sms' };
  }

  return { ok: true, value: { perCallUsd: callParsed.value, perSmsUsd: smsParsed.value } };
}

export function bulkRiskReport(snapshot: BulkSnapshot, costParams?: ReportCostParams) {
  const screenedRows = snapshot.rows.filter((row) => row.status === 'done');
  const screened = screenedRows.length;
  const breakdown = Object.fromEntries(RISK_CATEGORIES.map(([name, reasons]) => {
    const count = screenedRows.filter((row) => row.reason && reasons.has(row.reason as never)).length;
    return [name, { count, percent: percent(count, screened) }];
  }));
  const riskyRows = screenedRows.filter((row) => RISK_CATEGORIES.some(([, reasons]) => row.reason && reasons.has(row.reason as never))).length;

  let riskyActionsPrevented = 0;
  let heldForReview = 0;
  let evidenceRecords = 0;
  const byReason: Record<string, number> = {};

  for (const row of screenedRows) {
    const decision = publicRowDecision(row);
    if (decision === 'DENY') riskyActionsPrevented += 1;
    else if (decision === 'REVIEW') heldForReview += 1;
    if (row.evidenceId) evidenceRecords += 1;
    const reason = publicRowReason(row);
    if (reason) byReason[reason] = (byReason[reason] || 0) + 1;
  }

  const perCallUsd = costParams?.perCallUsd ?? null;
  const perSmsUsd = costParams?.perSmsUsd ?? null;
  const costAvoided = perCallUsd !== null
    ? {
        per_call_usd: perCallUsd,
        per_sms_usd: perSmsUsd,
        dial_cost_avoided_usd: Math.round(riskyActionsPrevented * perCallUsd * 100) / 100,
        assumptions: perSmsUsd !== null
          ? `Customer-stated $${perCallUsd.toFixed(2)}/call and $${perSmsUsd.toFixed(2)}/SMS applied to ${riskyActionsPrevented} denied voice actions.`
          : `Customer-stated $${perCallUsd.toFixed(2)}/call applied to ${riskyActionsPrevented} denied actions.`,
      }
    : null;

  const dataSources = snapshot.job.dataSourceSnapshot ?? buildDataSourceReceipts();
  const simulatedData = snapshot.job.simulatedData === true;
  const simulatedOrUnavailable = simulatedData
    || dataSources.some((receipt) => receipt.status === 'missing' || receipt.status === 'failed' || receipt.status === 'mock' || receipt.status === 'simulated');
  return {
    job_id: snapshot.job.id,
    report_generated_at: new Date().toISOString(),
    totals: {
      rows: snapshot.job.totalRows,
      unique: snapshot.job.uniqueRows,
      invalid: snapshot.job.invalidRows,
      duplicates: snapshot.job.duplicateRows,
      screened,
    },
    value: {
      risky_actions_prevented: riskyActionsPrevented,
      held_for_review: heldForReview,
      evidence_records: evidenceRecords,
      by_reason: byReason,
      cost_avoided: costAvoided,
    },
    risk_breakdown: breakdown,
    risky_rows: riskyRows,
    data_sources: dataSources,
    screened_with: dataSources,
    simulated_data: simulatedData,
    data_warning: simulatedOrUnavailable
      ? 'Some checks used simulated or unavailable data — this report is not valid for compliance decisions.'
      : null,
    disclaimer: 'Compliance tooling, not legal advice.',
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

export function reportHtml(report: ReturnType<typeof bulkRiskReport>) {
  const warning = report.data_warning
    ? `<section class="warning" role="alert"><strong>Data quality warning</strong><p>${escapeHtml(report.data_warning)}</p></section>`
    : '';
  const riskRows = Object.entries(report.risk_breakdown).map(([name, value]) => `<tr><th>${escapeHtml(name.replace(/_/g, ' '))}</th><td>${value.count}</td><td>${value.percent}%</td></tr>`).join('');
  const sourceRows = report.data_sources.map((source) => `<tr><th>${escapeHtml(source.id)}</th><td>${escapeHtml(source.vendor)}</td><td>${escapeHtml(source.status)}</td></tr>`).join('');
  const costCard = report.value.cost_avoided
    ? `<div class="card"><div class="muted">Dial cost avoided</div><div class="number">$${report.value.cost_avoided.dial_cost_avoided_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div class="muted small">${escapeHtml(report.value.cost_avoided.assumptions)}</div></div>`
    : '';
  const valueCols = report.value.cost_avoided ? 4 : 3;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VerifyOne pre-dial list audit report</title><style>
    @page{size:auto;margin:16mm}*{box-sizing:border-box}body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#18212f;margin:0;background:#f6f8fb}.page{max-width:900px;margin:32px auto;padding:32px;background:#fff;border:1px solid #dce2ea;border-radius:12px}h1{font-size:26px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 8px}.muted{color:#687486}.small{font-size:11px;margin-top:4px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:22px}.value-grid{display:grid;grid-template-columns:repeat(${valueCols},1fr);gap:10px;margin-top:10px}.card{border:1px solid #dce2ea;border-radius:8px;padding:12px}.number{font-size:22px;font-weight:700}.warning{border:2px solid #b54708;background:#fff4e5;color:#7a2e0e;padding:14px;margin:20px 0;border-radius:8px}.warning p{margin:4px 0 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #e6eaf0;padding:8px}td{color:#455163}.background{padding:14px;border-radius:8px;background:#f1f5fa;font-size:13px;color:#455163;margin-top:24px}.disclaimer{margin-top:20px;color:#687486;font-size:12px}a{color:#0074e2}@media print{body{background:#fff}.page{max-width:none;margin:0;padding:0;border:0;border-radius:0}.warning{print-color-adjust:exact;-webkit-print-color-adjust:exact}.grid{grid-template-columns:repeat(5,1fr)}}@media(max-width:640px){.page{margin:0;padding:20px;border-radius:0}.grid,.value-grid{grid-template-columns:repeat(2,1fr)}}
    </style></head><body><main class="page"><header><p class="muted">VERIFYONE · LIST AUDIT</p><h1>Pre-dial list audit report</h1><p class="muted">Job ${escapeHtml(report.job_id)} · counts only; no phone numbers included</p></header>${warning}<h2>What VerifyOne did</h2><section class="value-grid"><div class="card"><div class="muted">Risky actions prevented (DENY)</div><div class="number">${report.value.risky_actions_prevented}</div></div><div class="card"><div class="muted">Held for review (REVIEW)</div><div class="number">${report.value.held_for_review}</div></div><div class="card"><div class="muted">Evidence records created</div><div class="number">${report.value.evidence_records}</div></div>${costCard}</section><h2>List totals</h2><section class="grid"><div class="card"><div class="muted">Rows</div><div class="number">${report.totals.rows}</div></div><div class="card"><div class="muted">Unique valid</div><div class="number">${report.totals.unique}</div></div><div class="card"><div class="muted">Invalid</div><div class="number">${report.totals.invalid}</div></div><div class="card"><div class="muted">Duplicates</div><div class="number">${report.totals.duplicates}</div></div><div class="card"><div class="muted">Screened</div><div class="number">${report.totals.screened}</div></div></section><h2>Risk breakdown</h2><table><thead><tr><th>Category</th><th>Count</th><th>Share of screened</th></tr></thead><tbody>${riskRows}</tbody></table><h2>Data source status</h2><p class="muted small">See <a href="/data-sources">/data-sources</a> for source coverage, refresh cadence, and fail-closed failure behaviour.</p><table><thead><tr><th>Check</th><th>Source</th><th>Status</th></tr></thead><tbody>${sourceRows}</tbody></table><section class="background">Background: statutory damages under 47 U.S.C. § 227(b)(3) range $500–$1,500 per violation; this report does not estimate liability.</section><p class="disclaimer">${escapeHtml(report.disclaimer)}</p></main></body></html>`;
}
