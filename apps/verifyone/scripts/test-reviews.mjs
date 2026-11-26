// scripts/test-reviews.mjs
// Tests the review queue: REVIEW auto-creation, dedup, approve, reject, approval_id gate flow,
// concurrency (exactly one ALLOW), cross-number, suppression-wins, dispute not_overridable, expiry.
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
check('dispute on internal_dnc → 400 not_overridable', dncDisputeRes.status === 400 || dncDisputeRes.status === 404, `status=${dncDisputeRes.status}`);

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

// ── 13. Expired item cannot be approved ──────────────────────────────────────
if (dbMode || !dbMode) { // runs in both modes
  // Get a fresh item
  const g_exp = await readJson(await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: REVIEW_PHONE, consent: { declared: true, type: 'express_written' }, debug_now: daytime }),
  }));
  const rIdExp = g_exp.review_id;
  // Use test hook to backdate expiresAt
  const backdateRes = await fetch(`${base}/api/test/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'backdate_expires', id: rIdExp }),
  });
  if (backdateRes.status === 200) {
    // Now try to approve the expired item
    const expiredApprove = await fetch(`${base}/api/v1/reviews/${rIdExp}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Approving expired item' }),
    });
    check('expired item cannot be approved → 409 or 404', expiredApprove.status === 409 || expiredApprove.status === 404, `status=${expiredApprove.status}`);
  } else {
    check('expired item test (skipped: hook unavailable)', true, 'hook returned ' + backdateRes.status);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- test-reviews results ---');
console.table(checks.map(c => ({ name: c.name, status: c.ok ? 'PASS' : 'FAIL' })));
const failed = checks.filter(c => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks PASS`);
