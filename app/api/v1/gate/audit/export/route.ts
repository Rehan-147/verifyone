import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '../../../../../../lib/auth';
import { auditsToCsv, listAuditsForExport } from '../../../../../../lib/audit-db';
import { dbEnabled } from '../../../../../../lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  const acc = await authenticate(req);
  if (!acc) return NextResponse.json({ error: 'api_key_required' }, { status: 401 });
  if (acc.plan === 'FREE') {
    return NextResponse.json({ error: 'export_requires_paid_plan', upgrade: '/api/billing/checkout' }, { status: 403 });
  }

  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 86_400_000);
  const to = toParam ? new Date(toParam) : new Date();

  if (dbEnabled()) {
    const rows = await listAuditsForExport({ from, to, limit: 50_000 });
    const csv = auditsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="verifyone-audit-${from.toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const file = path.join(process.cwd(), '.data', 'audit.jsonl');
  let csv = 'evidence_id,created_at,decision,reason,record_hash\n';
  try {
    const lines = (await fs.readFile(file, 'utf8')).trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const rec = JSON.parse(line);
      const t = new Date(rec.created_at).getTime();
      if (t < from.getTime() || t > to.getTime()) continue;
      csv += `"${rec.evidence_id}","${rec.created_at}","${rec.decision}","${rec.reason}","${rec.record_hash}"\n`;
    }
  } catch {
    return NextResponse.json({ error: 'no_audit_data' }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="verifyone-audit-export.csv"',
    },
  });
}
