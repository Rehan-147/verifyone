import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation — Pre-Dial Compliance Gate API',
  description:
    'VerifyOne API documentation: quickstart, authentication, the pre-dial phone gate, decision values and the v1 ALLOW | DENY reference, checks and data sources, evidence records, fail-safe policy, MCP server, rate limits and credits, platform examples, and the compliance disclaimer.',
  alternates: { canonical: 'https://app.verifyone.io/docs' },
};

const BASE = (process.env.APP_URL || 'https://app.verifyone.io').replace(/\/+$/, '');

const SECTIONS = [
  ['quickstart', '1. Quickstart'],
  ['authentication', '2. Authentication'],
  ['pre-dial-phone-gate', '3. Pre-dial phone gate'],
  ['decision-values', '4. Decision values'],
  ['checks-and-data-sources', '5. Checks and data sources'],
  ['evidence-records', '6. Evidence records'],
  ['fail-safe-policy', '7. Error handling and fail-safe policy'],
  ['mcp-server', '8. MCP server'],
  ['rate-limits-and-credits', '9. Rate limits and credits'],
  ['platform-examples', '10. Platform examples'],
  ['compliance-disclaimer', '11. Compliance disclaimer'],
];

function Code({ children }: { children: string }) {
  return (
    <div className="terminal my-5">
      <pre>{children}</pre>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-xl sm:text-2xl font-extrabold text-ink font-display tracking-tight mt-14 mb-4">
      {children}
    </h2>
  );
}

const DECISION_MAP = [
  ['allow', 'ALLOW', 'All enabled checks passed. Proceed and store the evidence_id.'],
  ['review', '— (roadmap)', 'Native review is planned. Today: configure your agent to pause on specific reasons (for example QUIET_HOURS or REASSIGNED_NUMBER) instead of dialing.'],
  ['block', 'DENY', 'Do not act. Log the reason and keep the evidence_id. Timeouts and unavailable sources also return DENY (fail-closed).'],
];

const REASONS: [string, string][] = [
  ['PASS', 'All enabled checks cleared — decision is ALLOW.'],
  ['ACTIVE_HLR', 'Live HLR confirms the number is active (full_stack profile).'],
  ['LITIGATOR_TRAP', 'Number matched the litigator list — do not dial.'],
  ['DNC_NATIONAL_VIOLATION', 'On the federal DNC registry and no consent on file.'],
  ['REASSIGNED_NUMBER', 'Number may have been reassigned — re-verify consent.'],
  ['TCPA_AI_VOICE_CONSENT', 'AI-voice call requires express written consent — not on file.'],
  ['QUIET_HOURS', 'Outside the 8:00–21:00 local calling window at the number.'],
  ['DISCONNECTED', 'Number appears disconnected.'],
  ['INVALID_NUMBER', 'Not a valid E.164 phone number.'],
  ['GATE_UNAVAILABLE', 'A gate check failed or timed out — treated as DENY (fail closed).'],
  ['REGISTRY_UNAVAILABLE', 'A registry could not be reached — treated as DENY (fail closed).'],
];

export default function DocsPage() {
  return (
    <main className="bg-ground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:flex lg:gap-12">
        {/* Sidebar */}
        <aside className="lg:w-60 lg:shrink-0 mb-10 lg:mb-0 lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-secondary mb-3">API documentation</p>
          <nav aria-label="Docs sections">
            <ul className="space-y-1.5 text-sm">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-ink-secondary hover:text-accent transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8 dp-card p-4">
            <p className="text-xs text-ink-secondary leading-relaxed">
              New here? Create an account and get an API key plus free monthly checks — no card required.
            </p>
            <Link href="/dashboard" className="dp-btn-primary w-full text-center text-sm mt-3">
              Get API Key
            </Link>
          </div>
        </aside>

        {/* Content */}
        <article className="min-w-0 flex-1 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight mb-4">
            VerifyOne API documentation
          </h1>
          <p className="text-ink-secondary leading-relaxed">
            VerifyOne is the pre-action compliance gate for AI calling and messaging agents. One API call
            before every dial or send returns an auditable ALLOW or DENY decision — so your agent
            blocks risky contacts instead of creating liability. VerifyOne provides compliance controls and
            audit evidence; it does not provide legal advice or guarantee regulatory outcomes.
          </p>

          {/* 1. Quickstart */}
          <H2 id="quickstart">1. Quickstart</H2>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Call the pre-dial gate before placing an outbound call. Without an API key, requests are metered
            per IP (500 checks/month).{' '}
            <Link href="/dashboard" className="text-accent font-semibold hover:underline">Create an account</Link>{' '}
            for an API key and higher limits.
          </p>
          <Code>{`curl -X POST ${BASE}/api/v1/gate/phone \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+14155550123","channel":"voice"}'`}</Code>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Dial only on <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">ALLOW</code>.
            On <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">DENY</code>, log the reason and skip.
          </p>

          {/* 2. Authentication */}
          <H2 id="authentication">2. Authentication</H2>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Pass your key as a Bearer token or an <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">x-api-key</code> header.
            Keys are stored SHA-256 hashed and shown once at creation.
          </p>
          <Code>{`Authorization: Bearer vk_live_...
# or
x-api-key: vk_live_...`}</Code>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Create or rotate keys in the{' '}
            <Link href="/dashboard" className="text-accent font-semibold hover:underline">dashboard</Link>{' '}
            or via <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">POST /api/auth/signup</code>{' '}
            (returns the key once).
          </p>

          {/* 3. Pre-dial phone gate */}
          <H2 id="pre-dial-phone-gate">3. Pre-dial phone gate</H2>
          <Code>{`POST /api/v1/gate/phone

{
  "phone": "+14155550123",          // required, E.164
  "channel": "voice",               // "voice" | "sms" (default voice)
  "consent": {                       // optional — what you have on file
    "declared": true,
    "type": "express_written"        // "express_written" | "ebr" | "none"
  },
  "profile": "ai_outbound_shield",   // default | "full_stack" adds live HLR
  "live_hlr": false                  // shortcut for profile full_stack
}`}</Code>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">
            Related endpoints:
          </p>
          <ul className="text-sm text-ink-secondary space-y-2 list-disc pl-5">
            <li><code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">POST /api/v1/gate/batch</code> — pre-screen a list (max 5,000 keyed / 200 keyless).</li>
            <li><code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">POST /api/v1/gate/email</code> — pre-send gate for AI SDRs (send / hold / block).</li>
            <li><code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">POST /api/v1/gate/phone</code> — call before Vapi or Retell outbound call creation, and proceed only on <code>ALLOW</code>. Inbound screening (beta) rejects invalid numbers and flags matches in the loaded litigator list; per-account block-list lookup is not wired yet, and outbound DNC/consent rules are not applied.</li>
          </ul>

          {/* 4. Decision values */}
          <H2 id="decision-values">4. Decision values</H2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">
            VerifyOne&apos;s live product contract is <strong className="text-ink">ALLOW | REVIEW | DENY</strong> with a reason code and an
            evidence ID. REVIEW means the gate cannot safely confirm the call should proceed, so your agent should pause. The mapping below shows how the legacy{' '}
            <strong className="text-ink">allow | review | block</strong> field relates to each response.
          </p>
          <div className="overflow-x-auto rounded-xl border border-rule my-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-ground-muted">
                <tr>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Product contract</th>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Live v1 API</th>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Agent behavior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {DECISION_MAP.map(([product, v1, behavior]) => (
                  <tr key={product}>
                    <td className={`p-3 font-mono text-xs font-bold ${
                      product === 'allow' ? 'decision-allow' : product === 'review' ? 'decision-review' : 'decision-block'
                    }`}>{product}</td>
                    <td className="p-3 font-mono text-xs text-ink">{v1}</td>
                    <td className="p-3 text-ink-secondary">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-secondary leading-relaxed mb-3">Live v1 response fields:</p>
          <Code>{`{
  "decision": "ALLOW" | "DENY",
  "reason": "PASS" | "LITIGATOR_TRAP" | "DNC_NATIONAL_VIOLATION" | ...,
  "evidence_id": "ev_...",        // tamper-evident audit record id
  "risk_score": 0-100,
  "checks": { "valid_number": true, "line_type": "mobile", "dnc": {...}, ... },
  "fresh_for_hours": 24            // re-check recommendation
}`}</Code>
          <p className="text-sm text-ink-secondary leading-relaxed mb-3">Reason codes (v1):</p>
          <div className="overflow-hidden rounded-xl border border-rule my-5">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-rule">
                {REASONS.map(([code, desc]) => (
                  <tr key={code}>
                    <td className="p-3 font-mono text-xs text-accent whitespace-nowrap align-top w-56">{code}</td>
                    <td className="p-3 text-ink-secondary">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5. Checks and data sources */}
          <H2 id="checks-and-data-sources">5. Checks and data sources</H2>
          <ul className="text-sm text-ink-secondary space-y-2.5 list-disc pl-5 leading-relaxed">
            <li><strong className="text-ink">Number validity &amp; line type</strong> — E.164 validation, carrier, line type, disconnected status. Live carrier data via Telnyx when configured; otherwise cached/deterministic fallback.</li>
            <li><strong className="text-ink">Federal DNC</strong> — FTC National Do Not Call registry file, cached locally (authorized access; you are responsible for subscription/exemption rules).</li>
            <li><strong className="text-ink">Litigator screening</strong> — runs before DNC against your loaded litigator feed (vendor scrub file).</li>
            <li><strong className="text-ink">Reassigned numbers</strong> — FCC Reassigned Numbers Database pattern; requires the RNDB data file to be loaded, otherwise reported as unavailable (never silently skipped).</li>
            <li><strong className="text-ink">Calling hours</strong> — recipient-local 8:00–21:00 window via an area-code → IANA timezone map (US + Canada).</li>
            <li><strong className="text-ink">Consent recording</strong> — the gate records the consent you declare per request. It does not validate legal sufficiency.</li>
          </ul>
          <p className="text-sm text-ink-secondary leading-relaxed mt-4">
            See the live data-source receipts at{' '}
            <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">GET /api/v1/registry-health</code>{' '}
            or the <Link href="/status" className="text-accent font-semibold hover:underline">status page</Link>.
          </p>

          {/* 6. Evidence records */}
          <H2 id="evidence-records">6. Evidence records</H2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">
            Every gate request writes a hash-chained evidence record: request context (masked phone — last 4
            digits only), checks performed, decision, reason, and timestamps. Altering any record breaks the
            hash chain and is detectable.
          </p>
          <Code>{`GET /api/v1/gate/audit/{evidence_id}   // retrieve one record
GET /api/v1/gate/audit/chain           // verify the full chain
GET /api/v1/gate/audit/export          // CSV export (paid plans)
GET /api/v1/gate/ticket/{id}           // review ticket for a paused decision`}</Code>

          {/* 7. Error handling and fail-safe policy */}
          <H2 id="fail-safe-policy">7. Error handling and fail-safe policy</H2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">
            Missing, timed-out, or unavailable upstream checks must never silently become allow. The default
            is fail-closed: an incomplete check yields <strong className="text-ink">DENY</strong> with{' '}
            <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">GATE_UNAVAILABLE</code> or{' '}
            <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">REGISTRY_UNAVAILABLE</code>. Treat
            any 5xx, timeout, or network error as “do not act” and retry later.
          </p>
          <Code>{`HTTP 400 phone_required      — malformed request
HTTP 429 rate_limited        — slow down; retry_after seconds
HTTP 429 quota_exceeded      — free monthly quota used; sign up for a key
HTTP 401/403                 — missing or invalid API key
5xx / timeout                — fail closed: do not dial`}</Code>

          {/* 8. MCP server */}
          <H2 id="mcp-server">8. MCP server</H2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">
            The MCP endpoint at <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">POST /api/mcp</code> exposes
            the gate to any MCP-compatible agent client.
          </p>
          <Code>{`// claude_desktop_config.json / .mcp.json
{
  "mcpServers": {
    "verifyone": {
      "url": "${BASE}/api/mcp"
    }
  }
}`}</Code>
          <p className="text-sm text-ink-secondary leading-relaxed mb-3">
            Tool: <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">verifyone_pre_dial_gate</code>{' '}
            (alias of <code className="font-mono text-xs bg-ground-muted border border-rule px-1.5 py-0.5 rounded">check_call_allowed</code>; both work).
            Agent prompt rule:
          </p>
          <div className="rounded-xl border border-accent/30 bg-accent/[0.04] p-5 my-5">
            <p className="text-sm text-ink leading-relaxed">
              Before placing any outbound call or sending an outbound message, call{' '}
              <code className="font-mono text-xs">verifyone_pre_dial_gate</code>. If the decision is block, do not
              proceed. If the decision is review, pause or transfer to a human. If the decision is allow,
              proceed and store the evidence_id.
            </p>
          </div>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Other tools: <code className="font-mono text-xs">check_email_safety</code>,{' '}
            <code className="font-mono text-xs">validate_phone</code>, <code className="font-mono text-xs">verify_email</code>,{' '}
            <code className="font-mono text-xs">ip_lookup</code>, <code className="font-mono text-xs">bulk_verify</code>,{' '}
            <code className="font-mono text-xs">get_account</code>. Live MCP responses use the same v1 ALLOW | DENY contract.
          </p>

          {/* 9. Rate limits and credits */}
          <H2 id="rate-limits-and-credits">9. Rate limits and credits</H2>
          <div className="overflow-x-auto rounded-xl border border-rule my-5">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-ground-muted">
                <tr>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Profile</th>
                  <th className="p-3 text-left font-semibold text-ink-secondary">Credits</th>
                  <th className="p-3 text-left font-semibold text-ink-secondary">What it includes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                <tr>
                  <td className="p-3 font-mono text-xs">ai_outbound_shield</td>
                  <td className="p-3 font-mono text-xs">1 bundled credit / check</td>
                  <td className="p-3 text-ink-secondary">Validity, litigator, DNC, consent, calling hours — local caches, sub-100ms target.</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">full_stack</td>
                  <td className="p-3 font-mono text-xs">3 credits / check</td>
                  <td className="p-3 text-ink-secondary">Adds live HLR / carrier ping (requires a configured Telnyx key).</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">Email gate</td>
                  <td className="p-3 font-mono text-xs">1 credit / check</td>
                  <td className="p-3 text-ink-secondary">Pre-send email safety gate (send / hold / block).</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="text-sm text-ink-secondary space-y-2 list-disc pl-5">
            <li>Rate limit: 120 requests/minute per identity (sliding window).</li>
            <li>Free tier: 500 gate checks/month per IP without a key; account signup includes starter credits.</li>
            <li>Paid plans: <Link href="/pricing" className="text-accent font-semibold hover:underline">see pricing</Link>. Credits roll over for 3 months.</li>
            <li>Credit costs vary by enabled checks; the bundled profiles above are the launch metering.</li>
          </ul>

          {/* 10. Platform examples */}
          <H2 id="platform-examples">10. Platform examples</H2>
          <ul className="text-sm text-ink-secondary space-y-2.5 list-disc pl-5 leading-relaxed">
            <li><strong className="text-ink">Vapi</strong> — call <code className="font-mono text-xs">{BASE}/api/v1/gate/phone</code> first; create the Vapi call only on <code>ALLOW</code>. Inbound screening (beta) at <code className="font-mono text-xs">{BASE}/api/webhooks/vapi?assistant_id=...</code> rejects invalid numbers and flags loaded litigator matches; it has no per-account block-list lookup and does not apply outbound DNC/consent rules.</li>
            <li><strong className="text-ink">Retell</strong> — call <code className="font-mono text-xs">{BASE}/api/v1/gate/phone</code> first; call Retell&apos;s create-phone-call endpoint only on <code>ALLOW</code>. Inbound screening (beta) at <code className="font-mono text-xs">{BASE}/api/webhooks/retell</code> rejects invalid numbers and flags loaded litigator matches; it has no per-account block-list lookup and does not apply outbound DNC/consent rules.</li>
            <li><strong className="text-ink">Bland</strong> — call the REST gate from a custom function before the call tool.</li>
            <li><strong className="text-ink">n8n / Make / Zapier</strong> — HTTP Request node before the dialer node; branch on the decision.</li>
            <li><strong className="text-ink">Any MCP client</strong> — use the <code className="font-mono text-xs">verifyone_pre_dial_gate</code> tool.</li>
          </ul>
          <p className="text-sm text-ink-secondary leading-relaxed mt-4">
            Full snippets on the <Link href="/" className="text-accent font-semibold hover:underline">homepage developer section</Link> and{' '}
            <Link href="/for-platforms" className="text-accent font-semibold hover:underline">/for-platforms</Link>. Platforms without a
            dedicated endpoint work through API / webhook / custom function.
          </p>

          {/* 11. Compliance disclaimer */}
          <H2 id="compliance-disclaimer">11. Compliance disclaimer</H2>
          <div className="rounded-xl border border-rule bg-ground-muted p-5">
            <p className="text-sm text-ink-secondary leading-relaxed">
              VerifyOne provides compliance controls and audit evidence. It does not provide legal advice and
              does not guarantee regulatory outcomes. You remain responsible for your consent records,
              campaign practices, and compliance with applicable law — including TCPA, FCC, and FTC
              requirements. Registry access and data-source coverage depend on authorized use and loaded
              data files. See also our <Link href="/legal/compliance-disclaimer" className="text-accent font-semibold hover:underline">compliance disclaimer</Link> and{' '}
              <Link href="/security" className="text-accent font-semibold hover:underline">security page</Link>.
            </p>
          </div>

          <div className="mt-14 flex flex-wrap gap-3">
            <Link href="/dashboard" className="dp-btn-primary">Get API Key</Link>
            <Link href="/for-agents" className="dp-btn-secondary">Agency guide</Link>
          </div>
        </article>
      </div>
    </main>
  );
}
