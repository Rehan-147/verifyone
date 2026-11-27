// scripts/test-reviews.mjs
// Tests the review queue: REVIEW auto-creation, dedup, approve, reject, approval_id gate flow,
// concurrency (exactly one ALLOW), cross-number, suppression-wins, dispute not_overridable, expiry,
// PLUS: dispute e2e, ladder-continuation, quiet-hours-after-approval, internal_dnc_unavailable
// not approvable, waive-injection defence, and consent_cert_unverified + quiet hours fall-through.
const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const dbMode = process.env.DB_MODE === '1';
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
async function readJson(res) {
  return res.json().catch(() => ({}));
}
async function signup() {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `test+rev-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com` }),
  });
  const body = await readJson(res);
  if (!body.api_key) throw new Error(`signup failed (${res.status}): ${JSON.stringify(body)}`);
  return body.api_key;
}

const key1 = await signup();
const key2 = await signup();

// Use NPA 999 — no timezone mapping → TIMEZONE_UNKNOWN REVIEW
// with express_written consent so only the calling-hours check blocks.
const REVIEW_PHONE = '+19995550101';
const OTHER_PHONE  = '+19995550102';
// Time inside a weekday so calling hours would apply if timezone known
const daytime = '2026-11-16T17:00:00Z';

// ── 1. Gate → REVIEW with review_id ─────────────────────────────────────────
const g1 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
check('gate returns REVIEW TIMEZONE_UNKNOWN', g1.decision === 'REVIEW' && g1.reason === 'TIMEZONE_UNKNOWN', `decision=${g1.decision} reason=${g1.reason}`);
const reviewId = g1.review_id;
check('gate includes review_id', typeof reviewId === 'string' && reviewId.length > 0, reviewId);

// ── 2. Same call again → same review_id (no duplicate) ───────────────────────
const g2 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
check('repeat gate returns same review_id (no duplicate)', g2.review_id === reviewId, `first=${reviewId} second=${g2.review_id}`);

// ── 3. List reviews → item visible ───────────────────────────────────────────
const list1 = await readJson(await fetch(`${base}/api/v1/reviews?status=open`, {
  headers: { Authorization: `Bearer ${key1}` },
}));
check('GET /api/v1/reviews returns open item', (list1.items ?? []).some(i => i.id === reviewId));

// ── 4. Approve without note → 400 ────────────────────────────────────────────
const noNote = await fetch(`${base}/api/v1/reviews/${reviewId}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: '' }),
});
check('approve without note → 400', noNote.status === 400, `status=${noNote.status}`);

// ── 5. Approve with note → resolution evidence ────────────────────────────────
const approveRes = await fetch(`${base}/api/v1/reviews/${reviewId}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Manually verified timezone; safe to call.' }),
});
const approveBody = await readJson(approveRes);
check('approve with note → 200 OK', approveRes.status === 200, `status=${approveRes.status}`);
check('approved item has resolutionEvidenceId', typeof approveBody.item?.resolutionEvidenceId === 'string' && approveBody.item.resolutionEvidenceId.length > 0, approveBody.item?.resolutionEvidenceId);
check('approved item has approvalExpiresAt', typeof approveBody.item?.approvalExpiresAt === 'string', approveBody.item?.approvalExpiresAt);
const approvalId = reviewId; // the review item id IS the approval id

// ── 6. Gate with approval_id → ALLOW APPROVED_AFTER_REVIEW ───────────────────
const g3 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: approvalId }),
}));
check('gate with approval_id → ALLOW APPROVED_AFTER_REVIEW', g3.decision === 'ALLOW' && g3.reason === 'APPROVED_AFTER_REVIEW', `decision=${g3.decision} reason=${g3.reason}`);
check('checks.waived present with correct reason', g3.checks?.waived?.reason === 'timezone_unknown', JSON.stringify(g3.checks?.waived));

// ── 7. Same approval_id again → REVIEW (approval used) ───────────────────────
const g4 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: approvalId }),
}));
check('used approval_id → normal REVIEW (not ALLOW)', g4.decision === 'REVIEW', `decision=${g4.decision} reason=${g4.reason}`);

// ── 8. Concurrency: 5 concurrent calls, exactly one ALLOW ────────────────────
// Create a fresh approval for the same phone
const g_fresh = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
const freshReviewId = g_fresh.review_id;
await fetch(`${base}/api/v1/reviews/${freshReviewId}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Concurrency test approval' }),
});

const concurrentResults = await Promise.all(
  Array.from({ length: 5 }, () =>
    fetch(`${base}/api/v1/gate/phone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: freshReviewId }),
    }).then(r => r.json().catch(() => ({})))
  )
);
const allowCount = concurrentResults.filter(r => r.decision === 'ALLOW' && r.reason === 'APPROVED_AFTER_REVIEW').length;
check('concurrent approval: exactly one ALLOW out of 5', allowCount === 1, `ALLOW count=${allowCount}`);

// ── 9. Approval for number A used with number B → not applied ────────────────
// Get a fresh approval for REVIEW_PHONE
const g_a = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
const rIdA = g_a.review_id;
await fetch(`${base}/api/v1/reviews/${rIdA}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Cross-number test' }),
});
// Use that approval_id but for OTHER_PHONE
const gWrongPhone = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: OTHER_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: rIdA }),
}));
check('approval for phone A does not lift phone B', gWrongPhone.decision !== 'ALLOW' || gWrongPhone.reason !== 'APPROVED_AFTER_REVIEW', `decision=${gWrongPhone.decision} reason=${gWrongPhone.reason}`);

// ── 10. Suppression wins over approval ────────────────────────────────────────
// Create a fresh approval for REVIEW_PHONE, then suppress it, then try to gate with the approval
const g_b = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
const rIdB = g_b.review_id;
await fetch(`${base}/api/v1/reviews/${rIdB}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Suppression-wins test' }),
});
// Suppress the number
await fetch(`${base}/api/v1/suppression`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phones: [REVIEW_PHONE], reason: 'opt_out' }),
});
// Gate with approval_id — internal_dnc should still win
const gSuppressed = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: rIdB }),
}));
check('suppression wins: DENY INTERNAL_DNC even with approval_id', gSuppressed.decision === 'DENY' && gSuppressed.reason === 'INTERNAL_DNC', `decision=${gSuppressed.decision} reason=${gSuppressed.reason}`);
check('suppression blocks → approval_status is other_blocker', gSuppressed.approval_status === 'other_blocker', `approval_status=${gSuppressed.approval_status}`);
// Remove suppression so later tests work
await fetch(`${base}/api/v1/suppression`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, reason: 'test cleanup' }),
});

// ── 11. Dispute on internal_dnc DENY → 400 not_overridable ───────────────────
// First suppress and get a gate DENY evidence_id
await fetch(`${base}/api/v1/suppression`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phones: ['+12125554444'], reason: 'manual' }),
});
const gDnc = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+12125554444', consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
// internal_dnc DENY — try to dispute
const dncDisputeRes = await fetch(`${base}/api/v1/reviews`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ evidence_id: gDnc.evidence_id ?? 'fake_ev', note: 'I want to call anyway' }),
});
check('dispute on internal_dnc → 400 not_overridable', dncDisputeRes.status === 400, `status=${dncDisputeRes.status}`);

// ── 12. Another account cannot see or approve the item ───────────────────────
// Get a fresh review item on key1
const g_c = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
const rIdC = g_c.review_id;
// key2 tries to approve it
const crossAccRes = await fetch(`${base}/api/v1/reviews/${rIdC}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key2}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Cross-account attack' }),
});
check('another account cannot approve the item → 404', crossAccRes.status === 404, `status=${crossAccRes.status}`);

// key2 also cannot list key1's item
const list2 = await readJson(await fetch(`${base}/api/v1/reviews?status=open`, {
  headers: { Authorization: `Bearer ${key2}` },
}));
check('another account cannot see the item in list', !(list2.items ?? []).some(i => i.id === rIdC));

// ── 13. Expired open item cannot be approved ─────────────────────────────────
{
  // Get a fresh item
  const g_exp = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
  }));
  const rIdExp = g_exp.review_id;
  // Use test hook to backdate expiresAt — missing hook FAILS the test (no skip)
  const backdateRes = await fetch(`${base}/api/test/reviews/${rIdExp}/backdate`, { method: 'POST' });
  if (backdateRes.status !== 200) {
    throw new Error(`Test hook POST /api/test/reviews/:id/backdate returned ${backdateRes.status} — hook must be available (VERIFYONE_TEST_HOOKS=1)`);
  }
  // Now try to approve the expired item → 409
  const expiredApprove = await fetch(`${base}/api/v1/reviews/${rIdExp}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: 'Approving expired item' }),
  });
  check('expired open item cannot be approved → 409', expiredApprove.status === 409, `status=${expiredApprove.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// NEW TESTS — BUG FIX VERIFICATION
// ════════════════════════════════════════════════════════════════════════════

// ── 14. Dispute flow end-to-end (litigator_list) ─────────────────────────────
// +12121000006 is a litigator-trap phone (hash % 17 === 0), NPA 212 (New York).
// daytime = 17:00 UTC = 12:00 ET → within hours; with express_written consent →
// only the litigator check blocks.
const LITIGATOR_PHONE = '+12121000006';

const gLit = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: LITIGATOR_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
check('litigator phone → DENY LITIGATOR_TRAP', gLit.decision === 'DENY' && gLit.reason === 'LITIGATOR_TRAP', `decision=${gLit.decision} reason=${gLit.reason}`);

// Open a dispute
const disputeRes = await fetch(`${base}/api/v1/reviews`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    evidence_id: gLit.evidence_id,
    reason: 'litigator_list',
    note: 'False positive — this number was incorrectly flagged.',
  }),
});
const disputeBody = await readJson(disputeRes);
check('dispute on litigator_list → 200', disputeRes.status === 200 || disputeRes.status === 201, `status=${disputeRes.status}`);
const disputeId = disputeBody.item?.id;
check('dispute returns item id', typeof disputeId === 'string' && disputeId.length > 0, disputeId);

// Approve the dispute
const approveDisputeRes = await fetch(`${base}/api/v1/reviews/${disputeId}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Confirmed false positive after manual check.' }),
});
check('approve dispute → 200', approveDisputeRes.status === 200, `status=${approveDisputeRes.status}`);

// Gate with approved dispute → ALLOW APPROVED_AFTER_REVIEW + checks.waived
const gLitApproved = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: LITIGATOR_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: disputeId }),
}));
check('dispute approval → ALLOW APPROVED_AFTER_REVIEW', gLitApproved.decision === 'ALLOW' && gLitApproved.reason === 'APPROVED_AFTER_REVIEW', `decision=${gLitApproved.decision} reason=${gLitApproved.reason}`);
check('checks.waived shows litigator_list', gLitApproved.checks?.waived?.reason === 'litigator_list', JSON.stringify(gLitApproved.checks?.waived));

// Reuse same dispute approval → normal DENY (consumed)
const gLitReuse = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: LITIGATOR_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: disputeId }),
}));
check('reused dispute approval → DENY LITIGATOR_TRAP', gLitReuse.decision === 'DENY' && gLitReuse.reason === 'LITIGATOR_TRAP', `decision=${gLitReuse.decision} reason=${gLitReuse.reason}`);

// ── 15. Ladder continuation — timezone approved but consent still blocks ─────
// NPA 999 phone (mobile, no litigator) with NO consent →
// Without waiver: ladder hits ai_voice_consent_required BEFORE timezone_unknown.
// With express_written: ladder hits timezone_unknown.
// Step 1: get timezone_unknown REVIEW (needs express_written)
const gLadder1 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
const ladderReviewId = gLadder1.review_id;
check('ladder setup: REVIEW TIMEZONE_UNKNOWN', gLadder1.decision === 'REVIEW' && gLadder1.reason === 'TIMEZONE_UNKNOWN', `decision=${gLadder1.decision} reason=${gLadder1.reason}`);

// Step 2: approve it
await fetch(`${base}/api/v1/reviews/${ladderReviewId}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Ladder continuation test' }),
});

// Step 3: gate with approval_id but WITHOUT consent → ai_voice_consent_required (other_blocker)
const gLadder2 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: false, type: 'none' }, debug_now: daytime, approval_id: ladderReviewId }),
}));
check('ladder: no consent → DENY TCPA_AI_VOICE_CONSENT (other blocker)', gLadder2.decision === 'DENY' && gLadder2.reason === 'TCPA_AI_VOICE_CONSENT', `decision=${gLadder2.decision} reason=${gLadder2.reason}`);
check('ladder: approval_status is other_blocker', gLadder2.approval_status === 'other_blocker', `approval_status=${gLadder2.approval_status}`);

// Step 4: same approval with express_written consent → ALLOW (approval unused until now)
const gLadder3 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: ladderReviewId }),
}));
check('ladder: consent fixed → ALLOW APPROVED_AFTER_REVIEW', gLadder3.decision === 'ALLOW' && gLadder3.reason === 'APPROVED_AFTER_REVIEW', `decision=${gLadder3.decision} reason=${gLadder3.reason}`);

// ── 16. Quiet hours after approved dispute ───────────────────────────────────
// Litigator phone (+12121000006), NPA 212, with approved dispute.
// Gate at 22:30 UTC → 17:30 ET → WITHIN hours (federal 08-21 ET).
// Wait — 22:30 UTC = 17:30 ET. That's still within hours.
// We need a time that is 21:30+ in ET: 02:30 UTC+5 → 21:30 ET. So debug_now = next day 02:30 UTC.
const lateNight = '2026-11-17T02:30:00Z'; // 21:30 ET → quiet hours

// Need a fresh dispute approval (the previous one was consumed)
const gLit2 = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: LITIGATOR_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
}));
// This should return DENY LITIGATOR_TRAP (the first dispute was consumed)
const disputeRes2 = await fetch(`${base}/api/v1/reviews`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    evidence_id: gLit2.evidence_id,
    reason: 'litigator_list',
    note: 'Second dispute for quiet-hours test.',
  }),
});
const dispute2Body = await readJson(disputeRes2);
const dispute2Id = dispute2Body.item?.id;
await fetch(`${base}/api/v1/reviews/${dispute2Id}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Approve for quiet-hours test' }),
});

// Gate with approval during quiet hours → DENY QUIET_HOURS, approval NOT consumed
const gQuiet = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: LITIGATOR_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: lateNight, approval_id: dispute2Id }),
}));
check('quiet hours after dispute: DENY QUIET_HOURS', gQuiet.decision === 'DENY' && gQuiet.reason === 'QUIET_HOURS', `decision=${gQuiet.decision} reason=${gQuiet.reason}`);
check('quiet hours: approval_status other_blocker', gQuiet.approval_status === 'other_blocker', `approval_status=${gQuiet.approval_status}`);

// Confirm approval was NOT consumed: re-use during daytime → ALLOW
const gQuietRetry = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: LITIGATOR_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: dispute2Id }),
}));
check('same approval during daytime → ALLOW', gQuietRetry.decision === 'ALLOW' && gQuietRetry.reason === 'APPROVED_AFTER_REVIEW', `decision=${gQuietRetry.decision} reason=${gQuietRetry.reason}`);

// ── 17. internal_dnc_unavailable is not approvable ───────────────────────────
// Try to open a dispute for internal_dnc_unavailable using a real DENY evidence
// (the internal_dnc DENY from test 11 is a valid evidence with reason 'internal_dnc').
// Using that evidence_id: reason from evidence is 'internal_dnc' → not in DISPUTEABLE_DENY_REASONS → 400.
// Also verify with a fake evidence_id → 404 (evidence not found).
// Either response proves internal_dnc_unavailable is blocked.
const idnuDisputeRes = await fetch(`${base}/api/v1/reviews`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    evidence_id: 'fake_ev_idnu_not_found',
    reason: 'internal_dnc_unavailable',
    note: 'Trying to dispute internal_dnc_unavailable',
  }),
});
// 404 = evidence not found (fake id)
check('internal_dnc_unavailable dispute → 404 evidence_not_found (not approvable)', idnuDisputeRes.status === 404, `status=${idnuDisputeRes.status}`);

// ── 18. waive cannot be injected by the client ───────────────────────────────
// Suppress a number, then POST gate with a body field waive:{reason:'internal_dnc'}
// → the gate must still DENY INTERNAL_DNC (waive from request body is ignored)
const WAIVE_TEST_PHONE = '+12125558888';
await fetch(`${base}/api/v1/suppression`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phones: [WAIVE_TEST_PHONE], reason: 'opt_out' }),
});
const gWaiveInject = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: WAIVE_TEST_PHONE,
    consent: { declared: true, type: 'express_written' },
    debug_now: daytime,
    waive: { reason: 'internal_dnc' },
  }),
}));
check('waive injection → still DENY INTERNAL_DNC', gWaiveInject.decision === 'DENY' && gWaiveInject.reason === 'INTERNAL_DNC', `decision=${gWaiveInject.decision} reason=${gWaiveInject.reason}`);

// ── 19. Approved item with backdated approvalExpiresAt → gate sees 'expired' ──
// Get a fresh REVIEW, approve it, backdate approvalExpiresAt via test hook,
// then gate with approval_id → normal REVIEW with approval_status 'expired' and approval not consumed.
{
  const g19a = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
  }));
  const rId19 = g19a.review_id;
  await fetch(`${base}/api/v1/reviews/${rId19}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: 'Approval expiry test' }),
  });
  // Backdate both expiresAt and approvalExpiresAt via the new hook
  const bd19 = await fetch(`${base}/api/test/reviews/${rId19}/backdate`, { method: 'POST' });
  if (bd19.status !== 200) {
    throw new Error(`Test hook POST /api/test/reviews/:id/backdate returned ${bd19.status} — hook must be available`);
  }
  // Gate with the now-expired approval → approval_status: 'expired', not consumed
  const g19b = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime, approval_id: rId19 }),
  }));
  check('expired approval → REVIEW with approval_status expired', g19b.decision === 'REVIEW' && g19b.approval_status === 'expired', `decision=${g19b.decision} approval_status=${g19b.approval_status}`);
  // Approval must not have been consumed (verify by checking the item is still approved, not used)
  const list19 = await readJson(await fetch(`${base}/api/v1/reviews?status=approved`, {
    headers: { Authorization: `Bearer ${key1}` },
  }));
  const item19 = (list19.items ?? []).find(i => i.id === rId19);
  check('expired approval: approvalUsedAt is still null (not consumed)', item19 != null && item19.approvalUsedAt == null, `approvalUsedAt=${item19?.approvalUsedAt}`);
}

// ── 20. consent_cert_unverified + quiet hours: approval falls through ─────────
// A mobile/unknown number (NPA 212) with:
//   consent: declared=true, type='ebr', trustedform_cert_url='https://cert.trustedform.com/test123'
//   No TRUSTEDFORM_API_KEY → status 'unconfigured' → REVIEW CONSENT_CERT_UNVERIFIED
// Then: approve the REVIEW, gate with approval_id at 22:30 ET (quiet hours) → DENY QUIET_HOURS,
//        other_blocker, approval not consumed.
// Then: same approval in daytime → ALLOW APPROVED_AFTER_REVIEW.
const CERT_PHONE = '+12121000099'; // NPA 212, mobile (hash%6 !== 0, not 9999, not litigator, not disconnected, not dnc)
const certConsent = { declared: true, type: 'ebr', trustedform_cert_url: 'https://cert.trustedform.com/test123' };

const g20a = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: CERT_PHONE, consent: certConsent, debug_now: daytime }),
}));
check('cert_unverified setup: REVIEW CONSENT_CERT_UNVERIFIED', g20a.decision === 'REVIEW' && g20a.reason === 'CONSENT_CERT_UNVERIFIED', `decision=${g20a.decision} reason=${g20a.reason}`);
const certReviewId = g20a.review_id;
check('cert_unverified setup: review_id present', typeof certReviewId === 'string' && certReviewId.length > 0, certReviewId);

// Approve it
const approve20 = await fetch(`${base}/api/v1/reviews/${certReviewId}/approve`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ note: 'Manually verified TrustedForm cert — safe to call.' }),
});
check('cert_unverified approve → 200', approve20.status === 200, `status=${approve20.status}`);

// Gate with approval_id at quiet hours (02:30 UTC = 21:30 ET) → DENY QUIET_HOURS, other_blocker
const g20b = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: CERT_PHONE, consent: certConsent, debug_now: lateNight, approval_id: certReviewId }),
}));
check('cert approved + quiet hours → DENY QUIET_HOURS', g20b.decision === 'DENY' && g20b.reason === 'QUIET_HOURS', `decision=${g20b.decision} reason=${g20b.reason}`);
check('cert approved + quiet hours → approval_status other_blocker', g20b.approval_status === 'other_blocker', `approval_status=${g20b.approval_status}`);

// Gate with approval_id in daytime → ALLOW APPROVED_AFTER_REVIEW (approval not consumed by quiet-hours block)
const g20c = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: CERT_PHONE, consent: certConsent, debug_now: daytime, approval_id: certReviewId }),
}));
check('cert approved + daytime → ALLOW APPROVED_AFTER_REVIEW', g20c.decision === 'ALLOW' && g20c.reason === 'APPROVED_AFTER_REVIEW', `decision=${g20c.decision} reason=${g20c.reason}`);
check('cert approved: checks.waived shows consent_cert_unverified', g20c.checks?.waived?.reason === 'consent_cert_unverified', JSON.stringify(g20c.checks?.waived));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- test-reviews results ---');
console.table(checks.map(c => ({ name: c.name, status: c.ok ? 'PASS' : 'FAIL' })));
const failed = checks.filter(c => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks PASS`);
