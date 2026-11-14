const base = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
let failures = 0;
let sequence = 1000;

function check(name, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures += 1;
}

async function request(phone, debugNow) {
  const response = await fetch(`${base}/api/v1/gate/phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      consent: { declared: true, type: 'express_written' },
      debug_now: debugNow,
    }),
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const transientReasons = new Set([
  'invalid_number', 'disconnected', 'litigator_list',
  'reassigned_number_consent_required', 'do_not_call_no_consent',
  'gate_unavailable_fail_closed', 'consent_cert_invalid',
  'reassigned_check_unavailable', 'ai_voice_consent_required',
  'consent_cert_unverified', 'registry_unavailable_fail_closed',
]);

async function findCandidate(npa, debugNow, desiredReason) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const subscriber = String(sequence++).padStart(7, '0').slice(-7);
    const phone = `+1${npa}${subscriber}`;
    const result = await request(phone, debugNow);
    if (result.status !== 200) {
      check(`${npa} request returned HTTP 200`, false, `HTTP ${result.status}: ${result.body.error || 'request failed'}`);
      return null;
    }
    const reason = result.body.reason_legacy;
    if (reason === desiredReason) return { phone, ...result.body };
    if (transientReasons.has(reason)) continue;
    return { phone, ...result.body };
  }
  check(`${npa} candidate without unrelated gate outcomes`, false, '40 candidates had unrelated outcomes');
  return null;
}

async function expectCase({ name, npa, debugNow, decision, reason, zones }) {
  const result = await findCandidate(npa, debugNow, reason === 'PASS' ? 'cleared' : reason);
  if (!result) return;
  const internalReason = result.reason_legacy;
  const expectedReasons = reason === 'PASS'
    ? new Set(['cleared', 'cleared_landline', 'dnc_but_consent_on_file'])
    : new Set([reason]);
  check(name, result.decision === decision && expectedReasons.has(internalReason),
    `decision=${result.decision}, reason=${internalReason}`);
  if (zones) {
    const actual = result.checks?.calling_hours;
    check(`${name} evaluates every NPA timezone`,
      Array.isArray(actual?.timezones)
        && zones.every((zone) => actual.timezones.includes(zone))
        && Array.isArray(actual?.local_times)
        && actual.local_times.length === actual.timezones.length,
      `timezones=${JSON.stringify(actual?.timezones)}, local_times=${JSON.stringify(actual?.local_times)}`);
  }
}

await expectCase({ name: '212 at 12:00 ET is within federal hours', npa: '212', debugNow: '2026-01-15T17:00:00Z', decision: 'ALLOW', reason: 'PASS' });
await expectCase({ name: '212 at 21:30 ET is quiet hours', npa: '212', debugNow: '2026-01-16T02:30:00Z', decision: 'DENY', reason: 'quiet_hours' });
await expectCase({ name: '305 at 20:30 ET applies Florida hours', npa: '305', debugNow: '2026-01-16T01:30:00Z', decision: 'DENY', reason: 'state_quiet_hours' });
await expectCase({ name: '305 at 19:30 ET is within Florida hours', npa: '305', debugNow: '2026-01-16T00:30:00Z', decision: 'ALLOW', reason: 'PASS' });
await expectCase({ name: '850 split NPA blocks at 20:30 Eastern / 19:30 Central', npa: '850', debugNow: '2026-01-16T01:30:00Z', decision: 'DENY', reason: 'state_quiet_hours', zones: ['America/New_York', 'America/Chicago'] });
await expectCase({ name: '541 split NPA blocks when Mountain time is 21:30', npa: '541', debugNow: '2026-01-16T04:30:00Z', decision: 'DENY', reason: 'quiet_hours', zones: ['America/Los_Angeles', 'America/Boise'] });

const unknown = await findCandidate('999', '2026-01-15T17:00:00Z', 'timezone_unknown');
if (unknown) {
  check('unassigned 999 NPA requires review', unknown.decision === 'REVIEW' && unknown.reason === 'TIMEZONE_UNKNOWN' && unknown.reason_legacy === 'timezone_unknown',
    `decision=${unknown.decision}, reason=${unknown.reason}, legacy=${unknown.reason_legacy}`);
}

await expectCase({ name: '08:00 boundary is allowed', npa: '212', debugNow: '2026-01-15T13:00:00Z', decision: 'ALLOW', reason: 'PASS' });
await expectCase({ name: '20:59 boundary is allowed', npa: '212', debugNow: '2026-01-16T01:59:00Z', decision: 'ALLOW', reason: 'PASS' });
await expectCase({ name: '21:00 boundary is blocked', npa: '212', debugNow: '2026-01-16T02:00:00Z', decision: 'DENY', reason: 'quiet_hours' });

process.exit(failures === 0 ? 0 : 1);
