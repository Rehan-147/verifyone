export const dynamic = 'force-dynamic';

// CRON: weekly ROI digest. Vercel Cron / GitHub Actions / cron-job.org hits this
// with header `x-cron-secret: $CRON_SECRET`; it computes the week's gate stats and
// POSTs a human-readable digest to DIGEST_WEBHOOK_URL (Slack/Discord/Make-compatible).
// Env: CRON_SECRET, DIGEST_WEBHOOK_URL (optional — stats are returned either way).
import { NextRequest, NextResponse } from 'next/server';
import { summarizeGate } from '../../../../lib/audit-store';

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const stats = await summarizeGate(7);
  if (!stats || stats.total_checks === 0) {
    return NextResponse.json({ sent: false, reason: 'no_gate_activity_this_week' });
  }

  const lines = Object.entries(stats.blocked_by_reason)
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `• ${n} × ${r}`)
    .join('\n');
  const text =
    `🛡 VerifyOne weekly digest\n` +
    `Checks: ${stats.total_checks} · Allowed: ${stats.allowed} · Blocked: ${stats.blocked}\n` +
    `${lines || '• nothing blocked'}\n` +
    `💰 Saved ~$${stats.savings.dialing_cost_usd} dialing cost · $${stats.savings.tcpa_exposure_avoided_usd.toLocaleString()} TCPA exposure avoided`;

  let sent = false;
  const hook = process.env.DIGEST_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), // Slack/Discord/Teams-compatible "text" payload
        signal: AbortSignal.timeout(8000),
      });
      sent = true;
    } catch {}
  }

  return NextResponse.json({ sent, digest: text, stats });
}
