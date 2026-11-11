import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'For Agencies — Run AI Calling Campaigns with a Compliance Gate',
  description:
    'Put a pre-dial compliance gate in front of every AI calling campaign. Each dial carries its own channel, consent and profile, returns ALLOW or DENY with a typed reason, and lands in a hash-chained evidence trail you can export per client.',
  alternates: { canonical: 'https://app.verifyone.io/for-agents' },
};

const CAPABILITIES: { title: string; body: string }[] = [
  {
    title: 'Campaign context travels with the call',
    body: 'Every gate request carries the channel, the consent you captured and the check profile for that campaign — so consent captured for one client is never assumed for another.',
  },
  {
    title: 'Consent is checked, not assumed',
    body: 'Declare express_written, ebr or none. An AI voice call with no consent on record comes back DENY with TCPA_AI_VOICE_CONSENT instead of quietly dialing.',
  },
  {
    title: 'Batch-screen lists before launch',
    body: 'Upload a CSV in the dashboard to screen a list ahead of the campaign, then gate again at dial time. Bulk screening and live gating use the same credit balance.',
  },
  {
    title: 'Clear block reasons',
    body: 'Every DENY ships with a typed reason — quiet hours, DNC match, reassigned number, missing consent — so your team knows what to fix instead of guessing.',
  },
  {
    title: 'Evidence exports',
    body: 'Export the audit CSV for client reporting, disputes or counsel. Every record is hash-chained and verifiable — "the agent decided" is never your answer.',
  },
  {
    title: 'API and MCP access',
    body: 'Gate calls from any dialer over REST, wire the native Vapi and Retell webhooks, or give your agents the verifyone_pre_dial_gate MCP tool.',
  },
];

const BASE = (process.env.APP_URL || 'https://app.verifyone.io').replace(/\/+$/, '');

export default function ForAgentsPage() {
  return (
    <main className="bg-ground">
      {/* Hero — light, left-aligned (Caution layout) */}
      <section style={{ background: 'radial-gradient(circle at 50% 12%, var(--theme-page-glow) 0%, transparent 55%) no-repeat, var(--theme-page)', padding: '7rem 0 5rem' }}>
        <div className="container">
          <span className="eyebrow">For AI voice-agent agencies</span>
          <h1 className="hero-title" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.25rem)', maxWidth: '44rem' }}>
            Run AI calling campaigns with a compliance gate.
          </h1>
          <p className="hero-description" style={{ marginTop: 'var(--spacing4)' }}>
            Before your agents dial, VerifyOne checks each contact and returns an auditable allow,
            review, or block decision — with evidence your clients can read.
          </p>
          <div className="cta-group">
            <Link href="/dashboard" className="cta-btn">Book an agency walkthrough</Link>
            <Link href="/docs" className="cta-link">
              Read the docs
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--theme-text-faint)', fontFamily: 'ui-monospace, monospace' }}>
            The walkthrough starts from a free account — you can test the gate immediately.
          </p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="dp-card p-6">
                <h2 className="font-bold text-base text-ink font-display mb-2">{c.title}</h2>
                <p className="text-sm text-ink-secondary leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agency workflow */}
      <section className="bg-ground-muted py-20 px-4 border-t border-rule">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight mb-4 text-center">
            The agency workflow
          </h2>
          <p className="text-ink-secondary text-center mb-10 max-w-2xl mx-auto">
            Screen the list before the campaign, gate the dial during it, and export the evidence after it.
          </p>
          <ol className="space-y-4 max-w-2xl mx-auto">
            {[
              ['Pre-flight the list', 'Batch-screen up to 5,000 numbers before launch. Numbers that would be blocked never reach the dialer.'],
              ['Gate every dial', 'Wire the gate into Vapi, Retell, or your dialer. Every call gets a decision, reason, and evidence ID.'],
              ['Escalate reviews', 'Uncertain contacts route to a human reviewer instead of dialing blind.'],
              ['Report with evidence', 'Export per-campaign CSV records for client reporting — decisions, reasons, timestamps, chain-verified.'],
            ].map(([t, b], i) => (
              <li key={t} className="dp-card p-5 flex gap-4">
                <span className="shrink-0 h-8 w-8 rounded-full bg-accent/10 border border-accent/20 text-accent font-mono text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-ink font-display mb-1">{t}</h3>
                  <p className="text-sm text-ink-secondary leading-relaxed">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Quickstart */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-ink font-display tracking-tight mb-4 text-center">
            Test the gate in one request
          </h2>
          <div className="terminal">
            <div className="terminal-head">
              <span>POST /api/v1/gate/phone</span>
              <span className="normal-case tracking-normal">bash</span>
            </div>
            <pre>{`curl -X POST ${BASE}/api/v1/gate/phone \\
  -H "Authorization: Bearer vk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+14155550123","channel":"voice","consent":{"declared":true,"type":"express_written"}}'

# Live v1 response: { "decision": "ALLOW" | "DENY", "reason": "...", "evidence_id": "ev_..." }
# Dial only on ALLOW. Full contract: /docs#decision-values`}</pre>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="dp-btn-primary">Get API Key</Link>
            <Link href="/docs#pre-dial-phone-gate" className="dp-btn-secondary">Gate API reference</Link>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="bg-ground-muted py-10 px-4 border-t border-rule">
        <p className="text-center text-xs text-ink-secondary max-w-2xl mx-auto leading-relaxed">
          VerifyOne provides compliance controls and audit evidence. It does not provide legal advice or
          guarantee regulatory outcomes. You remain responsible for consent records, campaign practices, and
          applicable law.
        </p>
      </section>
    </main>
  );
}
