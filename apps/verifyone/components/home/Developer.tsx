import Link from 'next/link';

// ── SSR developer section — React Server Component, zero client JS ───────────
// The 8 integration tabs are pure CSS (:checked sibling selectors). The whole
// section renders on the server and every tab is reachable without JavaScript.
// The MCP tool name shown matches the additive alias exposed by /api/mcp.

const BASE = 'https://your-verifyone-host';

type Tab = { id: string; label: string; lang: string; code: string };

const TABS: Tab[] = [
  {
    id: 'rest', label: 'REST API', lang: 'bash',
    code: `curl -X POST ${BASE}/api/v1/gate/phone \\
  -H "Authorization: Bearer vk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+14155550123","channel":"voice","consent":{"declared":true,"type":"express_written"}}'

# Live v1 response (see /docs#decision-values):
# { "decision": "ALLOW" | "DENY", "reason": "...", "evidence_id": "ev_...", "risk_score": 0-100 }`,
  },
  {
    id: 'mcp', label: 'MCP', lang: 'json',
    code: `// claude_desktop_config.json / .mcp.json
{
  "mcpServers": {
    "verifyone": {
      "url": "${BASE}/api/mcp"
    }
  }
}

// Tool: verifyone_pre_dial_gate (alias of check_call_allowed)
//
// Agent prompt rule:
// Before placing any outbound call or sending an outbound message, call
// verifyone_pre_dial_gate. If the decision is block, do not proceed. If the
// proceed and store the evidence_id.
//
// Live MCP responses use ALLOW | DENY today — map DENY → block, ALLOW → allow.`,
  },
  {
    id: 'node', label: 'Node.js', lang: 'javascript',
    code: `const res = await fetch("${BASE}/api/v1/gate/phone", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.VERIFYONE_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ phone: to, channel: "voice" }),
});
const gate = await res.json();

// Live v1 contract: ALLOW | DENY (review is on the roadmap — see /docs)
if (gate.decision !== "ALLOW") {
  console.log("skipped", to, gate.reason, gate.evidence_id);
  return; // fail closed
}
await dialer.placeCall(to, { evidence_id: gate.evidence_id });`,
  },
  {
    id: 'python', label: 'Python', lang: 'python',
    code: `import os, requests

r = requests.post(
    "${BASE}/api/v1/gate/phone",
    headers={"Authorization": f"Bearer {os.environ['VERIFYONE_API_KEY']}"},
    json={"phone": to, "channel": "voice"},
    timeout=5,
)
gate = r.json()

# Live v1 contract: ALLOW | DENY (review is on the roadmap — see /docs)
if gate.get("decision") != "ALLOW":
    skip(to, reason=gate.get("reason"), evidence_id=gate.get("evidence_id"))
else:
    dialer.place_call(to, evidence_id=gate["evidence_id"])`,
  },
  {
    id: 'n8n', label: 'n8n', lang: 'text',
    code: `HTTP Request node (before your dialer node):
  Method: POST
  URL:    ${BASE}/api/v1/gate/phone
  Auth:   Header "Authorization: Bearer <your key>"
  Body:   { "phone": "{{ $json.phone }}", "channel": "voice" }

IF node:
  Condition: {{ $json.decision }} equals "ALLOW"
  true  → dialer / campaign node
  false → "Skip + log reason" branch (store evidence_id)

Batch option: POST /api/v1/gate/batch pre-screens up to 5,000 numbers before a campaign.`,
  },
  {
    id: 'vapi', label: 'Vapi', lang: 'text',
    code: `Outbound — gate before Vapi creates the call:
POST ${BASE}/api/v1/gate/phone
{ phone, channel: "voice", consent }

if decision === "ALLOW":
  POST https://api.vapi.ai/call
  { assistantId, phoneNumberId, customer: { number: phone } }
  # store evidence_id with your own call record
else: skip the call and store evidence_id.

Inbound screening webhook (beta): ${BASE}/api/webhooks/vapi?assistant_id=YOUR_ASSISTANT_ID
Rejects invalid numbers, flags loaded litigators; no per-account block-list lookup yet; no outbound DNC/consent rules.
Dial-through — VerifyOne places the call for you — coming soon.`,
  },
  {
    id: 'retell', label: 'Retell', lang: 'text',
    code: `Outbound — gate before Retell creates the call:
POST ${BASE}/api/v1/gate/phone
{ phone, channel: "voice", consent }

if decision === "ALLOW":
  POST https://api.retellai.com/v2/create-phone-call
  { from_number, to_number: phone }
  # store evidence_id with your own call record
else: skip the call and store evidence_id.

Inbound screening webhook (beta): ${BASE}/api/webhooks/retell
Rejects invalid numbers, flags loaded litigators; no per-account block-list lookup yet; no outbound DNC/consent rules.
Dial-through — VerifyOne places the call for you — coming soon.`,
  },
  {
    id: 'bland', label: 'Bland', lang: 'javascript',
    code: `Bland AI → custom function / pathway step before the call tool:

const gate = await fetch("${BASE}/api/v1/gate/phone", {
  method: "POST",
  headers: { "Authorization": "Bearer " + VERIFYONE_API_KEY,
             "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "{{phone}}", channel: "voice" }),
}).then(r => r.json());

if (gate.decision !== "ALLOW") {
  // Do not start the Bland call. Store reason and evidence_id in your own record.
  return;
}

// Start the Bland call here only after the gate returns ALLOW.`,
  },
];

export default function Developer() {
  return (
    <section id="developers" className="scroll-mt-20" style={{ padding: 'var(--spacing6) 0' }}>
      <div className="container" style={{ maxWidth: 1120 }}>
        <span className="eyebrow">Developers</span>
        <h2 className="landing-section-title">Add VerifyOne with one API call.</h2>
        <p className="section-lede">
          Use the REST gate before creating an outbound call, or try inbound screening webhooks (beta).
        </p>

        {/* CSS-only tabs — radios first for :checked ~ selectors */}
        <div className="csstabs" data-devtabs>
          {TABS.map((t, i) => (
            <input key={t.id} type="radio" name="devtab" id={`dv-${t.id}`} defaultChecked={i === 0} />
          ))}

          <div
            className="tabbtns flex flex-wrap gap-x-5 gap-y-2 mb-5"
            role="tablist"
            aria-label="Integration examples"
          >
            {TABS.map((t) => (
              <label
                key={t.id}
                htmlFor={`dv-${t.id}`}
                className="tabbtn font-mono text-[13px]"
                style={{ color: 'var(--theme-text-muted)', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderBottom: '2px solid transparent', paddingBottom: 2 }}
              >
                {t.label}
              </label>
            ))}
          </div>

          {TABS.map((t, i) => (
            <div key={t.id} id={`dvpanel-${t.id}`} className={`tabpanel ${i === 0 ? 'active-by-default' : ''}`}>
              <div className="terminal" role="tabpanel" aria-label={`${t.label} example`}>
                <div className="terminal-head">
                  <span>{t.label}</span>
                  <span className="normal-case tracking-normal">{t.lang}</span>
                </div>
                <pre>{t.code}</pre>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/docs" className="cta-link">
            Read the API docs
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
