/**
 * VerifyOne — Google Sheets custom function over the Pre-Dial / Pre-Send Gate.
 * Paste into Extensions > Apps Script, save, reload the sheet.
 *
 * ONE-TIME SETUP — File > Project properties > Script properties:
 *   VERIFYONE_URL    https://your-app.vercel.app     REQUIRED. Base URL of *your* deployed
 *                                                    VerifyOne. There is no default on purpose:
 *                                                    a hardcoded host would silently point every
 *                                                    sheet at someone else's app.
 *   VERIFYONE_KEY    vk_live_...                       Optional. Without it you burn the anonymous
 *                                                    free tier (500 gate checks/month, keyed by IP,
 *                                                    which Sheets clients do not control).
 *
 * USAGE
 *   =VERIFYONE(A2)                                 auto-detect, no consent declared
 *   =VERIFYONE(A2, "phone")                        force the phone gate
 *   =VERIFYONE(A2, "phone", "express_written")     consent on file — what the AI-voice shield needs
 *   =VERIFYONE(A2, "email")                        pre-send email gate
 *
 * RETURNS  "ALLOW — PASS — ev_3f1c…" / "DENY — DNC_NATIONAL_VIOLATION — ev_…"
 *   The trailing token is the evidence id; GET /api/v1/gate/audit/{id} re-plays the sealed
 *   decision, which is the part a compliance officer actually asks for.
 *
 * ONE ROW = ONE GATE CALL = ONE CREDIT. A 5,000-row column is 5,000 checks and will hit
 * quota_exceeded (surfaced as "ERROR — quota_exceeded"). Filter to the rows you intend to
 * dial, or run the same payload through POST /api/v1/gate/batch.
 *
 * The gate is fail-closed: an unreachable upstream returns DENY, never a false ALLOW. Do not
 * rewrite this function to treat a blank cell as clean.
 */

function VERIFYONE(value, type, consent) {
  var base = (PropertiesService.getScriptProperties().getProperty('VERIFYONE_URL') || '').replace(/\/+$/, '');
  if (!base) throw new Error('Set VERIFYONE_URL in File > Project properties > Script properties (e.g. https://your-app.vercel.app)');

  var apiKey = PropertiesService.getScriptProperties().getProperty('VERIFYONE_KEY');

  var trimmed = String(value === null || value === undefined ? '' : value).trim();
  if (!trimmed) return 'ERROR — empty cell';

  var kind = (type || (trimmed.indexOf('@') > -1 ? 'email' : 'phone')).toLowerCase();
  var isEmail = kind === 'email';

  var body;
  if (isEmail) {
    body = { email: trimmed };
  } else {
    var consentType = consent || 'none';
    body = {
      phone: trimmed,
      channel: 'voice',
      consent: { declared: consentType !== 'none', type: consentType },
    };
  }

  var headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  var res = UrlFetchApp.fetch(base + (isEmail ? '/api/v1/gate/email' : '/api/v1/gate/phone'), {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  var json;
  try {
    json = JSON.parse(res.getContentText());
  } catch (e) {
    return 'ERROR — HTTP ' + res.getResponseCode() + ' (not a gate response; check VERIFYONE_URL)';
  }

  if (json.error) return 'ERROR — ' + json.error + (json.retry_after ? ' (retry in ' + json.retry_after + 's)' : '');

  // The phone gate speaks ALLOW|DENY; the email gate speaks send|hold|block.
  var decision = String(json.decision || 'UNKNOWN').toUpperCase();
  if (isEmail) decision = { SEND: 'ALLOW', HOLD: 'HOLD', BLOCK: 'DENY' }[decision] || decision;

  return decision + ' — ' + (json.reason || 'no_reason') + (json.evidence_id ? ' — ' + json.evidence_id : '');
}
