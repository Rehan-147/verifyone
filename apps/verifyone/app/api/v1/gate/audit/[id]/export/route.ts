// SINGLE-EVIDENCE EXPORT — the record you hand a client, auditor, or regulator.
// Bulk CSV of the ledger already exists at /api/v1/gate/audit/export (paid).
// This produces the polished artifact for ONE decision:
//
//   GET /api/v1/gate/audit/{id}/export              -> signed JSON compliance record
//   GET /api/v1/gate/audit/{id}/export?format=html  -> printable one-pager (hand-off)
//   ?label=Client+name   adds a customer-supplied caption; the label is covered by
//                        the HMAC signature so the exporter cannot rewrite it later.
//
// The signature lets the recipient verify the artifact WITHOUT database access:
//   echo -n "<evidence_id.record_hash.prev_hash.decision.reason.created_at.label>" \
//     | openssl dgst -sha256 -hmac "<EVIDENCE_EXPORT_SECRET>"
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getEvidence, verifyChain } from '../../../../../../../lib/audit-store';
import { rateLimit, clientIp } from '../../../../../../../lib/auth';

// Every dynamic token must pass through this before touching HTML output.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sealed records carry the legacy decision enum (allow/review/block); the public
// contract vocabulary is ALLOW/REVIEW/DENY. Artifacts shown to customers speak
// the contract vocabulary; the raw stored value stays in evidence untouched.
const DECISION_LABEL: Record<string, string> = {
  allow: 'ALLOW',
  review: 'REVIEW',
  deny: 'DENY',
  block: 'DENY',
  outcome: 'OUTCOME',
};
function decisionLabel(raw: unknown): string {
  const k = String(raw ?? '').toLowerCase();
  return DECISION_LABEL[k] ?? String(raw ?? '').toUpperCase();
}
function decisionBadgeClass(raw: unknown): string {
  const k = String(raw ?? '').toLowerCase();
  if (k === 'allow') return 'allow';
  if (k === 'review') return 'review';
  if (k === 'block' || k === 'deny') return 'deny';
  return 'badge-muted';
}

// HMAC key for export sign-off. Falls back to CRON_SECRET, then a dev value —
// set EVIDENCE_EXPORT_SECRET in production so exports survive key rotation.
function exportSecret(): string {
  return process.env.EVIDENCE_EXPORT_SECRET || process.env.CRON_SECRET || 'verifyone-dev-export-secret';
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ip = clientIp(req);
  const rl = rateLimit('export:' + ip, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', retry_after: rl.retryAfter }, { status: 429 });
  }

  const { id } = await ctx.params;
  if (!/^ev_[a-f0-9]{6,40}$/.test(id)) {
    return NextResponse.json({ error: 'invalid_evidence_id' }, { status: 400 });
  }

  const record = await getEvidence(id);
  if (!record) {
    return NextResponse.json({ error: 'not_found', evidence_id: id }, { status: 404 });
  }

  const label = (req.nextUrl.searchParams.get('label') || '').trim().slice(0, 80);

  // Record integrity (this record alone) — same rule the audit read endpoint uses.
  let recomputed: string | null = null;
  try {
    recomputed = crypto
      .createHash('sha256')
      .update(JSON.stringify({ ...record, record_hash: undefined }))
      .digest('hex');
  } catch {}
  const integrity_ok = !!recomputed && recomputed === record.record_hash;

  // Whole-chain verification for the "verifiable today" line on the hand-off page.
  const chain = await verifyChain();

  const canonical = [
    record.evidence_id,
    record.record_hash,
    record.prev_hash,
    record.decision,
    record.reason,
    record.created_at,
    label,
  ].join('.');
  const signature = 'v1:' + crypto.createHmac('sha256', exportSecret()).update(canonical).digest('hex');

  const phoneMasked = record?.request?.phone_masked ?? '-';
  const phoneHash = record?.request?.phone_hash ? String(record.request.phone_hash).slice(0, 16) + '…' : '-';
  const channel = record?.request?.channel ?? 'unknown';
  const consent = record?.request?.consent_declared ?? null;

  const narrative =
    `On ${record.created_at} UTC, VerifyOne's pre-dial compliance gate evaluated ${phoneMasked} ` +
    `(number stored only as a salted-style hash ${phoneHash}) for ${channel} placement with ` +
    `declared consent context ${JSON.stringify(consent)}. The gate returned ${decisionLabel(record.decision)} ` +
    `(${record.reason}). The consulted data sources and their verdicts are listed in evidence.checks below. ` +
    `The record is sealed into the tamper-evident hash chain: record_hash ${record.record_hash}, ` +
    `chained to the previous record via prev_hash ${record.prev_hash}. This export itself is ` +
    `signed with the server-side EVIDENCE_EXPORT_SECRET (HMAC-SHA256), so it can be authenticated ` +
    `without access to the production ledger.`;

  const doc = {
    schema: 'verifyone.export.v1',
    generated_at: new Date().toISOString(),
    label: label || undefined,
    exhibit: 'VerifyOne Pre-Dial Compliance Record',
    summary: {
      evidence_id: record.evidence_id,
      decision: record.decision,
      decision_display: decisionLabel(record.decision),
      decision_note: 'sealed records use the internal enum (allow/review/block); decision_display is the public contract vocabulary',
      reason: record.reason,
      channel,
      phone_masked: phoneMasked,
      phone_hash_prefix: phoneHash,
      decided_at: record.created_at,
    },
    narrative,
    evidence: { ...record, integrity: { recomputed_hash_matches: integrity_ok } },
    chain: {
      record_hash: record.record_hash,
      prev_hash: record.prev_hash,
      chain_verified: chain.valid ?? false,
      records_in_chain: chain.records ?? null,
      verify_url: '/api/v1/gate/audit/chain',
    },
    export_signature: {
      signature,
      algorithm: 'HMAC-SHA256',
      key_ref: 'server-side EVIDENCE_EXPORT_SECRET (never exported)',
      covers: 'evidence_id.record_hash.prev_hash.decision.reason.created_at.label',
      how_to_verify: `echo -n "<the covers string>" | openssl dgst -sha256 -hmac <EVIDENCE_EXPORT_SECRET>  ->  ${signature.slice(0, 12)}… must match`,
    },
    disclaimer: 'This record evidences the gates VerifyOne evaluated. It is a compliance control, not legal advice.',
  };

  if (req.nextUrl.searchParams.get('format') === 'html') {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>VerifyOne Compliance Record — ${esc(record.evidence_id)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#1a1a2e;}
  h1{font-size:22px;margin:0 0 4px;}
  .muted{color:#667;}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:700;font-size:12px;border:1px solid #ddd;}
  .allow{background:#ecfdf5;color:#047857;border-color:#a7f3d0;}
  .deny{background:#fef2f2;color:#b91c1c;border-color:#fecaca;}
  .review{background:#fffbeb;color:#b45309;border-color:#fde68a;}
  .badge-muted{background:#f1f1f1;color:#4b5563;border-color:#e5e7eb;}
  table{width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;}
  td,th{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top;}
  th{background:#f9fafb;width:200px;font-weight:600;}
  pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;font-size:11px;overflow:auto;}
  .sig{background:#f9fafb;border:1px dashed #cbd5e1;border-radius:8px;padding:12px;font-size:12px;word-break:break-all;}
  footer{margin-top:26px;font-size:11px;color:#889;}
</style></head>
<body>
<h1>VerifyOne · Pre-Dial Compliance Record</h1>
<p class="muted">evidence ${esc(record.evidence_id)} · generated ${esc(doc.generated_at)}${label ? ` · label: ${esc(label)}` : ''}</p>
<p><span class="badge ${decisionBadgeClass(record.decision)}">${esc(decisionLabel(record.decision))}</span>
<span class="muted"> reason <code>${esc(record.reason)}</code> · ${esc(channel)} · at ${esc(record.created_at)} UTC</span></p>
<p>${esc(narrative)}</p>
<table>
  <tr><th>Called number (masked)</th><td><code>${esc(phoneMasked)}</code> — hash ${esc(phoneHash)}</td></tr>
  <tr><th>Declared consent</th><td><code>${esc(JSON.stringify(consent))}</code></td></tr>
  <tr><th>Integrity (this record)</th><td>${integrity_ok ? 'PASS — record_hash recomputes' : 'FAIL — record does not match its seal'}</td></tr>
  <tr><th>Hash chain</th><td>${chain.valid ? 'chain verified across ' + esc(String(chain.records ?? '?')) + ' records' : 'chain reported a problem — ' + esc(JSON.stringify(chain))}</td></tr>
  <tr><th>Export signature (HMAC-SHA256)</th><td class="sig">${esc(signature)}<br><span class="muted">covers ${esc(doc.export_signature.covers)}</span></td></tr>
</table>
<p>Consulted checks (the decision's evidence):</p>
<pre>${esc(JSON.stringify(record.checks, null, 2))}</pre>
<footer>${esc(doc.disclaimer)} Independent chain verification: <code>GET ${esc(doc.chain.verify_url)}</code></footer>
</body></html>`;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json(doc, { headers: { 'Cache-Control': 'no-store' } });
}
