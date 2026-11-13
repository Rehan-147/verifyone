import { hasKeyHeader, authenticate, clientIp } from '../../../lib/auth';
// MCP Server for AI Agents - Claude / Cursor / Codex
// URL: https://app.verifyone.io/api/mcp   (localhost dev: http://localhost:3000/api/mcp)
// Calls the gate + validators in-process (no HTTP self-fetch, no APP_URL needed).
import { NextRequest, NextResponse } from 'next/server'
import { runPhoneGate, runEmailGate } from '../../../lib/gate'
import { sealEvidence, checkAndBumpQuota } from '../../../lib/audit-store'
import { meter, creditsAvailable } from '../../../lib/auth'
import { validatePhone, verifyEmail, ipLookup } from '../../../lib/validators'
import { formatPublicGateResponse } from '../../../lib/gate-contract'
import { gateBundleCredits, resolveGateProfile } from '../../../lib/credits'
import { persistenceUnavailableResponse } from '../../../lib/persistence-response'
const TOOLS = [
  { name:'check_call_allowed', description:'PRE-DIAL FIREWALL for AI voice (Vapi/Retell/Bland). Returns decision ALLOW|DENY, reason (LITIGATOR_TRAP, DNC_NATIONAL_VIOLATION, PASS, ...), evidence_id. Litigator scrub runs before DNC. Default profile ai_outbound_shield = sub-100ms, 1 bundled credit. Dial ONLY on ALLOW.', inputSchema:{type:'object', properties:{phone:{type:'string'}, channel:{type:'string', enum:['voice','sms']}, consent:{type:'object'}, profile:{type:'string', enum:['ai_outbound_shield','full_stack']}, live_hlr:{type:'boolean'}}, required:['phone']} },
  { name:'verifyone_pre_dial_gate', description:'Pre-action compliance gate — additive alias of check_call_allowed (same handler, same ALLOW|DENY contract). Call before every outbound call or message: block → do not proceed, review → pause/human, allow → proceed and store evidence_id. Live v1 returns ALLOW|DENY.', inputSchema:{type:'object', properties:{phone:{type:'string'}, channel:{type:'string', enum:['voice','sms']}, consent:{type:'object'}, profile:{type:'string', enum:['ai_outbound_shield','full_stack']}, live_hlr:{type:'boolean'}}, required:['phone']} },
  { name:'check_email_safety', description:'PRE-SEND GATE for AI SDRs. Returns send|hold|block: disposable, role account, catch-all, syntax, bounce risk with sealed audit id.', inputSchema:{type:'object', properties:{email:{type:'string'}}, required:['email']} },
  { name:'validate_phone', description:'Validate phone carrier, line type, DNC, risk', inputSchema:{type:'object', properties:{phone:{type:'string'}}, required:['phone']} },
  { name:'verify_email', description:'Verify email valid/disposable/catch-all fraud score', inputSchema:{type:'object', properties:{email:{type:'string'}}, required:['email']} },
  { name:'ip_lookup', description:'IP geolocation fraud proxy detection', inputSchema:{type:'object', properties:{ip:{type:'string'}}, required:['ip']} },
  { name:'bulk_verify', description:'Bulk verify up to 2000 rows of {phone?, email?} via the gates', inputSchema:{type:'object', properties:{items:{type:'array'}}} },
  { name:'get_account', description:'Get plan, free-tier usage and limits', inputSchema:{type:'object', properties:{}} }
]

export async function POST(req: NextRequest) {
  const acc = await authenticate(req);
  if (hasKeyHeader(req) && !acc) {
    return NextResponse.json({ error: 'invalid_api_key', message: 'API key not recognized. Get one: POST /api/auth/signup' }, { status: 401 });
  }

  const body = await req.json()
  if (body.method === 'tools/list') return NextResponse.json({ tools: TOOLS })
  if (body.method === 'initialize') {
    return NextResponse.json({ protocolVersion: body.params?.protocolVersion ?? '2025-06-18', serverInfo: { name: 'verifyone', version: '1.0.0' }, capabilities: { tools: {} } })
  }
  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params
    const phoneGateTools = ['check_call_allowed', 'verifyone_pre_dial_gate'];
    const cost = phoneGateTools.includes(name)
      ? gateBundleCredits(resolveGateProfile(args ?? {}), { trustedform: typeof args?.consent?.trustedform_cert_url === 'string' })
      : 1;
    let quota: Awaited<ReturnType<typeof checkAndBumpQuota>> | null = null;
    if (acc) {
      if (!creditsAvailable(acc, cost)) {
        return NextResponse.json({ error: { code: 402, message: 'insufficient_credits' } }, { status: 402 });
      }
    } else {
      quota = await checkAndBumpQuota('ip:' + clientIp(req));
      if (!quota.allowed) return NextResponse.json({ error: { code: 429, message: `Free tier ${quota.monthly_limit}/month exceeded` } }, { status: 429 })
    }

    let result: any
    try {
      switch (name) {
        case 'verifyone_pre_dial_gate': // additive alias — same handler as check_call_allowed
        case 'check_call_allowed': {
          const profile = resolveGateProfile(args)
          const gate = await runPhoneGate({ phone: args.phone, channel: args.channel === 'sms' ? 'sms' : 'voice', consent: args.consent, profile, live_hlr: args.live_hlr === true })
          const { evidence } = await sealEvidence({ phone: args.phone, channel: args.channel === 'sms' ? 'sms' : 'voice', consent: args.consent ?? { declared: false, type: 'none' }, decision: gate.decision, reason: gate.reason, checks: gate.checks, callerKey: acc?.email || 'ip:' + clientIp(req) })
          result = formatPublicGateResponse(gate, { evidence_id: evidence.evidence_id, profile, live_hlr: profile === 'full_stack', upstream_live: gate.upstream_live })
          break
        }
        case 'check_email_safety': {
          result = await runEmailGate(args.email)
          const { evidence } = await sealEvidence({ phone: args.email, channel: 'email', consent: null, decision: result.decision, reason: result.reason, checks: result.checks, callerKey: acc?.email || 'ip:' + clientIp(req) })
          result.evidence_id = evidence.evidence_id
          break
        }
        case 'validate_phone': result = validatePhone(args.phone); break
        case 'verify_email': result = verifyEmail(args.email); break
        case 'ip_lookup': result = ipLookup(args.ip); break
        case 'bulk_verify': {
          const items: any[] = Array.isArray(args.items) ? args.items.slice(0, 2000) : []
          result = { results: items.map((it) => it.phone ? { phone: it.phone, ...runPhoneGateSync(it.phone) } : it.email ? { email: it.email, ...verifyEmail(it.email) } : { error: 'no phone or email' }) }
          break
        }
        case 'get_account': result = acc
          ? { plan: acc.plan, credits: acc.credits }
          : { plan: quota?.plan, used_this_month: quota?.used, monthly_limit: quota?.monthly_limit }; break
        default: return NextResponse.json({ error: { code: 400, message: 'unknown_tool', data: { name } } }, { status: 400 })
      }
    } catch (e: any) {
      if (e?.message === 'persistence_unavailable') return persistenceUnavailableResponse();
      return NextResponse.json({ error: { code: 500, message: String(e?.message || e) } }, { status: 500 })
    }
    if (acc && result?.reason !== 'gate_unavailable_fail_closed' && result?.reason !== 'fail_open_gate_unavailable') {
      const m = await meter(acc, cost, `/api/mcp:${name}`);
      if (m.race) console.warn('[billing] credit debit race after MCP tool result', { email: acc.email, cost, tool: name });
      if (name === 'get_account' && m.creditsLeft !== undefined) result.credits = m.creditsLeft;
    }
    return NextResponse.json({ content: [{ type: 'text', text: JSON.stringify(result) }] })
  }
  return NextResponse.json({ error: 'unknown_method', method: body.method }, { status: 400 })
}

// bulk helper: sync validators only (no sealed evidence per row in bulk)
function runPhoneGateSync(phone: string) {
  const base = validatePhone(phone)
  const dncListed = base.dnc === true
  return { valid: base.valid, lineType: base.lineType, dnc: dncListed, decision: !base.valid ? 'block' : dncListed ? 'block' : 'allow', reason: !base.valid ? 'invalid_number' : dncListed ? 'do_not_call_no_consent' : 'cleared' }
}

