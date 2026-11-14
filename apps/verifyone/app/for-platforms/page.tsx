import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'For AI Platforms — Add a Compliance Gate',
  description:
    'Explore adding VerifyOne before outbound actions in your AI agent platform. MCP, REST, or webhook integration paths; platform partnerships and white-labeling are exploratory.',
  alternates: { canonical: 'https://app.verifyone.io/for-platforms' },
};

const BENEFITS: { title: string; body: string }[] = [
  {
    title: 'Embed VerifyOne before outbound actions',
    body: 'One HTTPS call (or one MCP tool) before your agent dials or sends. Your platform keeps its UX; VerifyOne supplies the decision layer — ALLOW or DENY with a reason code and evidence ID.',
  },
  {
    title: 'Offer customers audit evidence',
    body: 'Every decision writes a tamper-evident record your customers can retrieve, verify, and export. Give your users compliance receipts instead of "the agent decided".',
  },
  {
    title: 'Use MCP, REST, or webhook integration',
    body: 'Vapi and Retell outbound use a REST gate-then-dial workflow. Their inbound screening (beta) rejects invalid numbers and flags matches in the loaded litigator list; per-account block-list lookup is not wired yet, and outbound DNC/consent rules are not applied. Other workflows can use REST, MCP where supported, or a generic adapter.',
  },
  {
    title: 'Explore white-label pilots',
    body: 'As a proposed pilot, a design partner could surface the gate under its own brand with an evidence portal. The integration and white-label workflow would need to be scoped and validated together.',
  },
  {
    title: 'Explore partnership options',
    body: 'For interested platforms, we can discuss referral economics and co-development. No platform partnership or revenue-share agreement is currently in place.',
  },
];

export default function ForPlatformsPage() {
  return (
    <main className="bg-ground">
      {/* Hero */}
      <section style={{ background: 'radial-gradient(circle at 50% 12%, var(--theme-page-glow) 0%, transparent 55%) no-repeat, var(--theme-page)', padding: '7rem 0 5rem' }}>
        <div className="container">
          <span className="eyebrow">For AI platforms &amp; developer tools</span>
          <h1 className="hero-title" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.25rem)', maxWidth: '44rem' }}>
            Add a compliance gate to your AI agent platform.
          </h1>
          <p className="hero-description" style={{ marginTop: 'var(--spacing4)' }}>
            Your agents dial and send on behalf of customers. Give them a pre-action compliance gate — and
            give your customers auditable evidence of every decision.
          </p>
          <div className="cta-group">
            <Link href="/dashboard" className="cta-btn">Partner with VerifyOne</Link>
            <Link href="/docs" className="cta-link">
              Read the docs
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {BENEFITS.map((b) => (
            <div key={b.title} className="dp-card p-7">
              <h2 className="font-bold text-base text-ink font-display mb-2">{b.title}</h2>
              <p className="text-sm text-ink-secondary leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How embedding works */}
      <section className="bg-ground-muted py-20 px-4 border-t border-rule">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight mb-4 text-center">
            How platforms embed the gate
          </h2>
          <p className="text-ink-secondary text-center mb-10 max-w-2xl mx-auto">
            The minimal pattern: call the gate as a pre-action step and branch on the decision. Live v1
            responses use ALLOW | DENY — the legacy allow | review | block mapping is documented in the{' '}
            <Link href="/docs#decision-values" className="text-accent font-semibold hover:underline">decision mapping</Link>.
          </p>
          <div className="terminal">
            <div className="terminal-head">
              <span>Pre-action pattern</span>
              <span className="normal-case tracking-normal">pseudo-code</span>
            </div>
            <pre>{`before outbound_action(contact, campaign):
  gate = POST /api/v1/gate/phone        # or verifyone_pre_dial_gate via MCP
         { phone: contact.e164, channel: campaign.channel }

  if gate.decision == "block":  return skip(gate.reason, gate.evidence_id)
  if gate.decision == "review": return pause_for_human(gate.evidence_id)
  # allow → proceed; keep the evidence_id with the call log
  return place_call(contact, evidence_id: gate.evidence_id)`}</pre>
          </div>
          <p className="text-center text-sm text-ink-secondary mt-8">
            Note: live v1 returns ALLOW | DENY today; map DENY → block. Native review is on the roadmap.
          </p>
        </div>
      </section>

      {/* Partnership CTA */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight mb-4">
            Build the gate into your platform with us.
          </h2>
          <p className="text-ink-secondary mb-8 leading-relaxed">
            We are open to exploring platform partnerships — integration help, a joint roadmap, and
            customer success would be scoped with each pilot. Start by creating an account to discuss it.
          </p>
          <Link href="/dashboard" className="dp-btn-primary inline-flex items-center gap-2 text-base px-6 py-3">
            Partner with VerifyOne
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
