import { creditsAvailable, findAccountByEmail, meter } from './auth';
import { sealEvidence } from './audit-store';
import { gateBundleCredits } from './credits';
import { runPhoneGateDecision } from './gate-service';
import { allowDevMocks } from './compliance-policy';
import { buildDataSourceReceipts } from './compliance-cache';
import {
  claimBulkJobLease,
  getBulkJob,
  mergeBulkDataSourceSnapshot,
  releaseBulkJobLease,
  renewBulkJobLease,
  updateBulkJobForLease,
  type BulkRow,
  type BulkRowPatch,
} from './bulk-store';

const UNCHARGED_REASONS = new Set(['gate_unavailable_fail_closed', 'fail_open_gate_unavailable']);

function consentFor(row: BulkRow, consentColumn: string | null) {
  const raw = consentColumn ? String(row.original[consentColumn] ?? '').trim().toLowerCase() : 'none';
  const type = raw === 'express_written' || raw === 'ebr' || raw === 'none' ? raw : 'none';
  return { declared: type !== 'none', type };
}

async function processRows(rows: BulkRow[], job: NonNullable<Awaited<ReturnType<typeof getBulkJob>>>['job'], email: string): Promise<{ patches: BulkRowPatch[]; sealFailed: boolean }> {
  const patches: BulkRowPatch[] = [];
  let cursor = 0;
  let sealFailed = false;
  const concurrency = Math.min(10, rows.length);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < rows.length && !sealFailed) {
      const row = rows[cursor++];
      try {
        const consent = consentFor(row, job.columns.consentColumn);
        const result = await runPhoneGateDecision({
          phone: row.phone,
          consent,
          mode: 'fail_closed',
          profile: job.profile,
        }, job.profile, job.profile === 'full_stack' ? 800 : 95);
        const sealed = await sealEvidence({
          phone: row.phone || '',
          channel: 'bulk',
          consent,
          decision: result.decision,
          reason: result.reason,
          checks: result.checks,
          callerKey: email,
        });
        patches.push({
          rowIndex: row.rowIndex,
          status: 'done',
          decision: result.decision,
          reason: result.reason,
          riskScore: result.risk_score,
          evidenceId: sealed.evidence.evidence_id,
        });
      } catch {
        sealFailed = true;
      }
    }
  }));
  return { patches, sealFailed };
}

async function processRowsWithRenewal(
  jobId: string,
  leaseToken: string,
  rows: BulkRow[],
  job: NonNullable<Awaited<ReturnType<typeof getBulkJob>>>['job'],
  email: string,
): Promise<{ patches: BulkRowPatch[]; sealFailed: boolean; leaseLost: boolean }> {
  let leaseLost = false;
  let renewals = Promise.resolve();
  const timer = setInterval(() => {
    renewals = renewals.then(async () => {
      if (!await renewBulkJobLease(jobId, leaseToken, 120_000)) leaseLost = true;
    }).catch(() => { leaseLost = true; });
  }, 30_000);
  timer.unref?.();
  try {
    const result = await processRows(rows, job, email);
    await renewals;
    return { ...result, leaseLost };
  } finally {
    clearInterval(timer);
    await renewals;
  }
}

function chargedEligibleCount(rows: BulkRow[], newPatches: BulkRowPatch[]) {
  const patchByIndex = new Map(newPatches.map((patch) => [patch.rowIndex, patch]));
  let count = 0;
  for (const row of rows) {
    const patch = patchByIndex.get(row.rowIndex);
    const status = patch?.status ?? row.status;
    const reason = patch?.reason ?? row.reason;
    if (status === 'done' && reason && !UNCHARGED_REASONS.has(reason)) count += 1;
  }
  return count;
}

export async function processBulkChunk(jobId: string, maxRows = 250) {
  const leaseToken = await claimBulkJobLease(jobId, 120_000);
  if (!leaseToken) return { acquired: false, job: await getBulkJob(jobId) };

  try {
    let snapshot = await getBulkJob(jobId);
    if (!snapshot) return { acquired: true, job: null };
    const email = snapshot.job.ownerKey.startsWith('email:') ? snapshot.job.ownerKey.slice(6) : '';
    const account = email ? await findAccountByEmail(email) : null;
    if (!account) {
      await updateBulkJobForLease(jobId, leaseToken, { status: 'failed' });
      return { acquired: true, job: await getBulkJob(jobId) };
    }

    const costPerRow = gateBundleCredits(snapshot.job.profile);
    const previouslyChargeable = chargedEligibleCount(snapshot.rows, []);
    const priorOutstanding = Math.max(0, previouslyChargeable * costPerRow - snapshot.job.creditsCharged);
    if (priorOutstanding > 0) {
      if (!creditsAvailable(account, priorOutstanding)) {
        await updateBulkJobForLease(jobId, leaseToken, { status: 'paused_insufficient_credits' });
        return { acquired: true, job: await getBulkJob(jobId) };
      }
      try {
        const debit = await meter(account, priorOutstanding, `/api/v1/bulk:${snapshot.job.profile}`);
        if (!debit.metered) {
          await updateBulkJobForLease(jobId, leaseToken, { status: 'paused_insufficient_credits' });
          return { acquired: true, job: await getBulkJob(jobId) };
        }
        if (!await updateBulkJobForLease(jobId, leaseToken, { creditsCharged: snapshot.job.creditsCharged + priorOutstanding })) {
          return { acquired: true, job: await getBulkJob(jobId), lease_lost: true };
        }
        snapshot = await getBulkJob(jobId) || snapshot;
      } catch {
        return { acquired: true, job: await getBulkJob(jobId), error: 'meter_unavailable' };
      }
    }
    const pending = snapshot.rows.filter((row) => row.status === 'pending').slice(0, Math.max(1, Math.min(250, Math.floor(maxRows))));
    if (pending.length) {
      const merged = await mergeBulkDataSourceSnapshot(jobId, leaseToken, buildDataSourceReceipts(), allowDevMocks());
      if (!merged) return { acquired: true, job: await getBulkJob(jobId), lease_lost: true };
      snapshot = await getBulkJob(jobId) || snapshot;
    }
    const results = pending.length
      ? await processRowsWithRenewal(jobId, leaseToken, pending, snapshot.job, account.email)
      : { patches: [] as BulkRowPatch[], sealFailed: false, leaseLost: false };
    if (results.leaseLost) return { acquired: true, job: await getBulkJob(jobId), lease_lost: true };

    if (results.patches.length) {
      const doneCount = snapshot.rows.filter((row) => row.status === 'done').length
        + results.patches.filter((patch) => patch.status === 'done').length;
      const saved = await updateBulkJobForLease(jobId, leaseToken, {
        processedRows: snapshot.job.invalidRows + snapshot.job.duplicateRows + doneCount,
      }, results.patches);
      if (!saved) return { acquired: true, job: await getBulkJob(jobId), lease_lost: true };
      snapshot = await getBulkJob(jobId) || snapshot;
    }

    const chargeable = chargedEligibleCount(snapshot.rows, []);
    const expectedCredits = chargeable * costPerRow;
    const outstanding = Math.max(0, expectedCredits - snapshot.job.creditsCharged);
    if (outstanding > 0) {
      if (!creditsAvailable(account, outstanding)) {
        await updateBulkJobForLease(jobId, leaseToken, { status: 'paused_insufficient_credits' });
        return { acquired: true, job: await getBulkJob(jobId), seal_failed: results.sealFailed };
      }
      try {
        const debit = await meter(account, outstanding, `/api/v1/bulk:${snapshot.job.profile}`);
        if (!debit.metered) {
          await updateBulkJobForLease(jobId, leaseToken, { status: 'paused_insufficient_credits' });
          return { acquired: true, job: await getBulkJob(jobId), seal_failed: results.sealFailed };
        }
        if (!await updateBulkJobForLease(jobId, leaseToken, { creditsCharged: snapshot.job.creditsCharged + outstanding })) {
          return { acquired: true, job: await getBulkJob(jobId), lease_lost: true };
        }
      } catch {
        return { acquired: true, job: await getBulkJob(jobId), error: 'meter_unavailable', seal_failed: results.sealFailed };
      }
    }

    snapshot = await getBulkJob(jobId) || snapshot;
    const hasPending = snapshot.rows.some((row) => row.status === 'pending');
    const status = !hasPending ? 'completed' : 'running';
    await updateBulkJobForLease(jobId, leaseToken, { status });
    return { acquired: true, job: await getBulkJob(jobId), seal_failed: results.sealFailed };
  } finally {
    await releaseBulkJobLease(jobId, leaseToken);
  }
}
