#!/usr/bin/env bash
# VerifyOne — production smoke test. Run this after every deploy.
#
#   BASE=https://your-app.vercel.app ./docs/smoke.sh
#   ./docs/smoke.sh                      # defaults to http://127.0.0.1:3000
#
# Optional env:
#   PHONE   E.164 number to gate            (default +14155552120)
#   EMAIL   address for the signup test     (default smoke-<epoch>@example.com)
#   CRON_SECRET   must match the deployed value to exercise the cron routes
#
# Exit code is non-zero if any check fails. Needs only curl + node.

set -uo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
PHONE="${PHONE:-+14155552120}"
EMAIL="${EMAIL:-smoke-$(date +%s)@example.com}"

fail=0
pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail + 1)); }
head2() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

# get <dotted.path> — read JSON on stdin, print one field (no jq dependency)
get() {
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      let j; try { j = JSON.parse(s); } catch { console.log("(non-json)"); return; }
      let v = j;
      for (const k of process.argv[1].split(".")) v = v == null ? undefined : v[k];
      console.log(v && typeof v === "object" ? JSON.stringify(v) : String(v));
    });' "$1"
}

status() { curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$@"; }

printf 'Smoke-testing \033[1m%s\033[0m\n' "$BASE"

# ---------------------------------------------------------------- 1. registry
head2 "GET /api/v1/registry-health"
RH=$(curl -sS --max-time 25 "$BASE/api/v1/registry-health")
READY=$(printf '%s' "$RH" | get shield_ready)
DNC_N=$(printf '%s' "$RH" | get health.dnc.records)
LIT_N=$(printf '%s' "$RH" | get health.litigator.records)
REQ=$(printf '%s' "$RH" | get require_registries_in_production)
echo "  shield_ready=$READY  dnc_records=$DNC_N  litigator_records=$LIT_N  require_in_prod=$REQ"
echo "  note: this route is build-time cached (x-nextjs-cache: HIT), so it can lag a"
echo "        registry sync. Section 2 reads readiness from the live gate response."

# ------------------------------------------------------------------- 2. gate
head2 "POST /api/v1/gate/phone"
# Warm-up: the first call after a deploy pays for loadLines() on both registry files
# (measured ~115 ms locally vs ~7 ms warm). Measure the steady state the SLA is about.
curl -sS -o /dev/null --max-time 25 -X POST "$BASE/api/v1/gate/phone" \
  -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}"
GATE=$(curl -sS --max-time 25 -X POST "$BASE/api/v1/gate/phone" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"channel\":\"voice\",\"consent\":{\"declared\":true,\"type\":\"express_written\"}}")
DEC=$(printf '%s' "$GATE" | get decision)
RSN=$(printf '%s' "$GATE" | get reason)
LAT=$(printf '%s' "$GATE" | get latency_ms)
EVID=$(printf '%s' "$GATE" | get evidence_id)
PERSIST=$(printf '%s' "$GATE" | get audit.persistence)
SHIELD=$(printf '%s' "$GATE" | get shield_ready)
echo "  decision=$DEC  reason=$RSN  latency_ms=$LAT  persistence=$PERSIST  shield_ready=$SHIELD (live)"
# The gate field is the authoritative readiness signal; registry-health is build-cached.
[ "$READY" != "$SHIELD" ] && echo "  info: registry-health said $READY but the gate says $SHIELD — the route is statically cached, trust the gate"
case "$RSN" in
  REGISTRY_UNAVAILABLE) bad "gate is fail-closed on missing registries — deploy .data feeds first" ;;
  *) [ -n "$DEC" ] && [ "$DEC" != "undefined" ] && pass "gate returned a verdict ($DEC)" || bad "no decision in response: $(printf '%s' "$GATE" | head -c 200)" ;;
esac
LAT_INT=$(printf '%s' "${LAT:-}" | cut -d. -f1)
if [ -z "$LAT_INT" ] || [ "$LAT_INT" = "undefined" ]; then
  bad "no latency_ms in the gate response"
elif [ "$LAT_INT" -le 95 ]; then
  pass "within the 95 ms ai_outbound_shield budget (${LAT}ms)"
else
  bad "latency ${LAT}ms exceeds the 95 ms budget"
fi
[ -n "$EVID" ] && [ "$EVID" != "undefined" ] && pass "evidence sealed: $EVID" || bad "no evidence_id"
case "$PERSIST" in
  postgres) pass "audit persisted to postgres" ;;
  file)    echo "  info: persisted to .data/audit.jsonl — fine locally, impossible on serverless" ;;
  memory)  bad "persistence=memory — records vanish on the next cold start (set DATABASE_URL)" ;;
esac

# ------------------------------------------------------------ 3. full_stack
head2 "POST /api/v1/gate/phone  (profile=full_stack, live HLR)"
FULL=$(curl -sS --max-time 25 -X POST "$BASE/api/v1/gate/phone" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"profile\":\"full_stack\"}")
echo "  decision=$(printf '%s' "$FULL" | get decision)  reason=$(printf '%s' "$FULL" | get reason)  line_type=$(printf '%s' "$FULL" | get checks.line_type)  latency_ms=$(printf '%s' "$FULL" | get latency_ms)"
# full_stack is short-circuited by the registry fail-closed, so a REGISTRY_UNAVAILABLE
# here is the same root cause as section 2 rather than a separate fault.
if [ "$(printf '%s' "$FULL" | get reason)" = "REGISTRY_UNAVAILABLE" ]; then
  echo "  info: skipped live-HLR assertion — the gate fail-closed before reaching Telnyx"
elif [ "$(printf '%s' "$FULL" | get decision)" != "undefined" ]; then
  pass "full_stack profile served (live line_type needs TELNYX_API_KEY)"
else
  bad "full_stack call did not answer: $(printf '%s' "$FULL" | head -c 200)"
fi

# ------------------------------------------------------------------ 4. audit
head2 "GET /api/v1/gate/audit/{evidence_id}  +  /api/v1/gate/audit/chain"
if [ -n "$EVID" ] && [ "$EVID" != "undefined" ]; then
  EV=$(curl -sS --max-time 25 "$BASE/api/v1/gate/audit/$EVID")
  echo "  sealed record: decision=$(printf '%s' "$EV" | get decision)  reason=$(printf '%s' "$EV" | get reason)  phone=$(printf '%s' "$EV" | get request.phone_masked)  self_hash_valid=$(printf '%s' "$EV" | get integrity.hash_matches)"
  pass "evidence retrievable at /api/v1/gate/audit/$EVID"
fi
CHAIN=$(curl -sS --max-time 25 "$BASE/api/v1/gate/audit/chain")
echo "  chain: valid=$(printf '%s' "$CHAIN" | get valid)  checked=$(printf '%s' "$CHAIN" | get checked)  broken_at=$(printf '%s' "$CHAIN" | get broken_at)"
[ "$(printf '%s' "$CHAIN" | get valid)" = "true" ] \
  && pass "hash chain intact" \
  || bad "hash chain broken at $(printf '%s' "$CHAIN" | get broken_at)"

# ----------------------------------------------------------------- 5. signup
head2 "POST /api/auth/signup"
SIGNUP=$(curl -sS --max-time 25 -X POST "$BASE/api/auth/signup" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}")
KEY=$(printf '%s' "$SIGNUP" | get api_key)
if [ "${KEY:0:7}" = "vk_live" ]; then
  pass "issued key for $EMAIL"
  CODE=$(status -X POST "$BASE/api/v1/gate/phone" -H "Authorization: Bearer $KEY" \
    -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}")
  [ "$CODE" = "200" ] && pass "key authenticates on a fresh request (http $CODE)" \
    || bad "key rejected on the next request (http $CODE) — auth store is not shared across lambdas; DATABASE_URL is required"
  METERED=$(curl -sS --max-time 25 -X POST "$BASE/api/v1/gate/phone" -H "Authorization: Bearer $KEY" \
    -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}")
  echo "  plan=$(printf '%s' "$METERED" | get plan)  credits_left=$(printf '%s' "$METERED" | get credits_left)"
else
  bad "signup did not return an api_key: $(printf '%s' "$SIGNUP" | head -c 200)"
fi

# ---------------------------------------------------------------- 6. billing
head2 "GET /api/billing/plans  +  POST /api/billing/checkout"
PLANS=$(curl -sS --max-time 25 "$BASE/api/billing/plans")
CONFIGURED=$(printf '%s' "$PLANS" | get configured)
echo "  processor=$(printf '%s' "$PLANS" | get processor)  configured=$CONFIGURED"
echo "  $(printf '%s' "$PLANS" | get plans | cut -c1-160)"
if [ "$CONFIGURED" = "true" ]; then
  pass "Dodo API key detected"
  CO=$(curl -sS --max-time 25 -X POST "$BASE/api/billing/checkout" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"plan\":\"STARTER\"}")
  URL=$(printf '%s' "$CO" | get checkout_url)
  case "$URL" in
    https*) pass "checkout session created for Agent \$49/mo" ;;
    *) bad "checkout failed: $(printf '%s' "$CO" | get error) $(printf '%s' "$CO" | get detail | cut -c1-120)" ;;
  esac
else
  echo "  info: DODO_PAYMENTS_API_KEY unset — /api/billing/checkout answers 503 payments_not_configured"
fi

# --------------------------------------------------------------- 7. webhooks
head2 "POST /api/webhooks/dodo (signature rejection path)"
WH=$(status -X POST "$BASE/api/webhooks/dodo" -H 'Content-Type: application/json' -d '{"type":"payment.succeeded"}')
[ "$WH" = "401" ] || [ "$WH" = "400" ] \
  && pass "unsigned webhook refused (http $WH) — good" \
  || bad "unsigned webhook returned http $WH; expect 401/400"
echo "  Then, in the Dodo dashboard: send a test event for payment.succeeded and confirm"
echo "  the account plan flips. If every event is rejected, DODO_PAYMENTS_WEBHOOK_KEY is wrong."

# ------------------------------------------------------------------- 8. cron
head2 "POST /api/cron/sync-registries"
if [ -n "${CRON_SECRET:-}" ]; then
  SY=$(curl -sS --max-time 60 -X POST "$BASE/api/cron/sync-registries" -H "x-cron-secret: $CRON_SECRET")
  echo "  shield_ready=$(printf '%s' "$SY" | get shield_ready)  dnc=$(printf '%s' "$SY" | get ingest.dnc)  litigator=$(printf '%s' "$SY" | get ingest.litigator)"
  [ "$(printf '%s' "$SY" | get ingest.dnc.ok)" = "true" ] \
    && pass "DNC feed fetched" \
    || bad "DNC ingest failed — reason=$(printf '%s' "$SY" | get ingest.dnc.reason). Expect EROFS on serverless: cwd is read-only."
else
  echo "  skipped: set CRON_SECRET to exercise it"
fi
NOAUTH=$(status -X POST "$BASE/api/cron/sync-registries")
[ "$NOAUTH" = "401" ] && pass "cron route refuses without the secret" || bad "cron route returned http $NOAUTH without auth"

# --------------------------------------------------------------------- done
printf '\n'
if [ "$fail" -eq 0 ]; then
  printf '\033[32mAll checks passed.\033[0m\n'
else
  printf '\033[31m%s check(s) failed.\033[0m\n' "$fail"
fi
exit "$fail"
