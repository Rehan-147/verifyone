// SEO guide: solo-operator AI voice outbound (US + Canada focus).
// House rules honored here: not legal advice; pricing comes from lib/plans.ts
// (single source); Vapi/Retell outbound use REST gate-then-dial and their
// inbound screening webhooks are beta.
import type { Metadata } from 'next';
import Link from 'next/link';
import { PLANS } from '../../../lib/plans';

export const metadata: Metadata = {
  title: 'Solo AI Voice Agents: Platforms, Compliance & Costs',
  description:
    'Beginner-friendly AI voice agent platforms, the FCC/TCPA rules that apply to solo automated calling in the US (and Canada), and what a solo voice agent setup costs per month — with a line-item cost table.',
  alternates: { canonical: 'https://app.verifyone.io/guides/solo-ai-voice-outbound' },
  keywords: [
    'solo AI voice agent',
    'AI voice agent platforms',
    'TCPA compliance AI calls',
    'FCC robocall rules AI voice',
    'AI voice agent cost per month',
    'do not call registry business',
    'reassigned number check',
    'pre-dial compliance gate',
  ],
};

// FAQ entries — exact question strings are also the H2s and the JSON-LD names.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Top beginner-friendly AI voice agent platforms used by solo operators',
    a: `The usual first picks are Vapi, Retell AI, Bland AI, and Synthflow. Vapi and Retell suit hands-on builders, Bland is API-first, and Synthflow is the most no-code-friendly. Whichever platform you choose, add a compliance step before every dial — the full comparison is in the VerifyOne solo AI voice guide.`,
  },
  {
    q: 'FCC/TCPA legal compliance rules for running automated voice calls as a solo business in the US',
    a: `Solo businesses carry the same core obligations as any telemarketer: prior express written consent for prerecorded or AI voice calls to wireless numbers, scrubbing against the National Do Not Call Registry plus your own suppression list (and the Canadian DNCL if you call Canada), calling-hours limits (8 a.m. to 9 p.m. in the recipient local time zone in the US), reassigned-number checks, and accurate caller ID. This guide summarizes the rules in plain English — it is not legal advice, so confirm your specific use case with counsel.`,
  },
  {
    q: 'Average monthly costs of setting up a solo voice agent',
    a: `Most solo setups run from a few hundred to roughly $3,000 or more per month: platform and telephony usage scales with your minutes, phone numbers cost a few dollars each, registry and data checks vary by vendor, and a pre-dial compliance gate like VerifyOne starts at $${PLANS.STARTER.priceUsd} per month (Starter plan). The cost table in the guide breaks down every line item.`,
  },
];

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

// Prices/credits resolve from lib/plans.ts — the single source. Never hardcode.
const PRICE_RANGE = `$${PLANS.STARTER.priceUsd} – $${PLANS.PRO.priceUsd.toLocaleString('en-US')}`;
const CREDITS_LABEL = `${PLANS.STARTER.credits / 1_000}k / ${PLANS.GROWTH.credits / 1_000}k / ${PLANS.PRO.credits / 1_000}k`;

const PLATFORMS: { name: string; pick: string; style: string; gate: string }[] = [
  {
    name: 'Vapi',
    pick: 'You are comfortable with light developer work',
    style: 'Dashboard + API assistants; usage-based per-minute pricing',
    gate: 'Outbound: REST gate, then call on ALLOW. Inbound screening (beta) rejects invalid numbers and flags loaded litigators; no customer block list is wired, and outbound DNC/consent rules do not apply.',
  },
  {
    name: 'Retell AI',
    pick: 'You want a polished low-code builder',
    style: 'Visual agent builder with attached numbers; usage-based',
    gate: 'Outbound: REST gate, then call on ALLOW. Inbound screening (beta) rejects invalid numbers and flags loaded litigators; no customer block list is wired, and outbound DNC/consent rules do not apply.',
  },
  {
    name: 'Bland AI',
    pick: 'You are API-first and comfortable with webhooks',
    style: 'Calling agents driven by API calls and automation paths',
    gate: 'Generic HTTPS call to the gate API',
  },
  {
    name: 'Synthflow',
    pick: 'You want the most no-code experience',
    style: 'Visual flow builder — launch an agent without writing code',
    gate: 'Generic HTTPS call to the gate API',
  },
  {
    name: 'ElevenLabs Agents',
    pick: 'Voice quality is your top priority',
    style: 'Conversational agents with premium voices',
    gate: 'Generic HTTPS call to the gate API',
  },
  {
    name: 'DIY (Pipecat / LiveKit + carrier)',
    pick: 'You want full control of the stack',
    style: 'Open-source pipeline you run and pay per component',
    gate: 'REST or the MCP tool (implemented)',
  },
];

const RULES: { title: string; body: string }[] = [
  {
    title: 'AI voice is regulated voice',
    body: 'In February 2024 the FCC confirmed that AI-generated voices in outbound calls are treated as artificial or prerecorded voice under the TCPA — the same rules that apply to classic robocalls apply to your AI agent.',
  },
  {
    title: 'Consent is on you, not the platform',
    body: 'Prerecorded and AI voice calls to wireless numbers generally require prior express written consent for marketing calls; other call types carry different consent standards. The platform hosts the call — you own the consent record.',
  },
  {
    title: 'Scrub the registries before every dial',
    body: 'In the US that means the National Do Not Call Registry (free SAN access via telemarketing.donotcall.gov) plus your own internal suppression list. In Canada it means the CRTC-operated Canadian DNCL. A number on either list is a do-not-call.',
  },
  {
    title: 'Respect calling hours',
    body: 'US: 8 a.m. to 9 p.m. in the local time zone of the person being called. Canada: the CRTC limits unsolicited calls to roughly 9 a.m.–9:30 p.m. on weekdays and 10 a.m.–6 p.m. on weekends — check the current Unsolicited Telecommunications Rules before you launch.',
  },
  {
    title: 'Check for reassigned numbers',
    body: 'Phone numbers get recycled. Calling a number that was reassigned to a new subscriber is a classic TCPA suit fact pattern — the FCC Reassigned Numbers Database plus its safe harbor is the recognized way to check.',
  },
  {
    title: 'Present accurate caller ID',
    body: 'The Truth in Caller ID Act bans spoofed or misleading caller ID, and the TRACED Act pushes traceback accountability onto the call chain — including platforms.',
  },
  {
    title: 'Keep evidence per call',
    body: 'Consent records, scrub receipts, and calling decisions should be preserved for each call. A hash-chained audit trail you can export is the difference between a defensible file and a memory.',
  },
  {
    title: 'States add their own rules',
    body: 'Some states require telemarketer registration or apply stricter consent and hours rules. If you call at scale, a one-time counsel review is cheap relative to the downside.',
  },
];

const COST_ROWS: { item: string; range: string; driver: string }[] = [
  { item: 'AI voice platform usage', range: '$50 – $500+', driver: 'Minutes dialed — most platforms are per-minute' },
  { item: 'Phone numbers', range: '$5 – $30', driver: 'A few local DIDs, or one toll-free number' },
  { item: 'CRM / automation glue (Make, Zapier, n8n)', range: '$0 – $100', driver: 'Free tiers cover many solo setups' },
  { item: 'Registry & data checks', range: 'Varies', driver: 'FTC SAN access is free; RNDB and litigator feeds vary by vendor' },
  {
    item: 'Pre-dial compliance gate — VerifyOne',
    range: `${PRICE_RANGE} / mo`,
    driver: `${CREDITS_LABEL} credits on Starter / Growth / Pro`,
  },
];

export default function SoloAiVoiceOutboundGuide() {
  return (
    <main className="bg-ground">
      {/* Hero */}
      <section
        style={{
          background:
            'radial-gradient(circle at 50% 12%, var(--theme-page-glow) 0%, transparent 55%) no-repeat, var(--theme-page)',
          padding: '7rem 0 4rem',
        }}
      >
        <div className="container">
          <span className="eyebrow">Guide · Solo AI voice outbound</span>
          <h1 className="hero-title" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.25rem)', maxWidth: '46rem' }}>
            Run an AI voice agent solo — without becoming a compliance case study.
          </h1>
          <p className="hero-description" style={{ marginTop: 'var(--spacing4)' }}>
            The platforms worth starting with, the FCC/TCPA rules that apply to solo automated calling in the
            US and Canada, and what a working setup actually costs per month.
          </p>
          <div className="cta-group">
            <Link href="/dashboard" className="cta-btn">Open dashboard</Link>
            <Link href="/pricing" className="cta-link">
              See plans
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Section 1 — platforms */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight mb-4">
            Top beginner-friendly AI voice agent platforms used by solo operators
          </h2>
          <p className="text-ink-secondary leading-relaxed mb-8 max-w-3xl">
            Short answer: most solo operators start on <strong>Vapi, Retell AI, Bland AI, or Synthflow</strong>.
            Vapi and Retell fit hands-on builders, Bland rewards API comfort, and Synthflow is the easiest
            no-code route. All six options below can launch a solo outbound agent; the real differences are how
            much you want to build versus click, and how the platform lets you insert a pre-dial compliance
            check.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--theme-border-strong)' }}>
                  <th className="text-left py-3 pr-4 font-display font-bold text-ink">Platform</th>
                  <th className="text-left py-3 pr-4 font-display font-bold text-ink">Good first pick if…</th>
                  <th className="text-left py-3 pr-4 font-display font-bold text-ink">How solo operators run it</th>
                  <th className="text-left py-3 font-display font-bold text-ink">VerifyOne connection</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORMS.map((p) => (
                  <tr key={p.name} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    <td className="py-3 pr-4 font-semibold text-ink align-top">{p.name}</td>
                    <td className="py-3 pr-4 text-ink-secondary align-top">{p.pick}</td>
                    <td className="py-3 pr-4 text-ink-secondary align-top">{p.style}</td>
                    <td className="py-3 text-ink-secondary align-top">{p.gate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-secondary mt-4 leading-relaxed max-w-3xl">
            Beginner-friendly here means a solo operator can launch without writing much code. Verify pricing
            and features with each vendor directly — platforms change fast, and none of them handle US/Canada
            compliance rules for you. For Vapi and Retell outbound, your workflow calls VerifyOne before
            creating the platform call and proceeds only on ALLOW. Inbound screening is beta: it rejects invalid numbers,
            flags matches in the loaded litigator list, has no per-account block-list lookup yet, and does not apply outbound
            DNC/consent rules.
          </p>
        </div>
      </section>

      {/* Section 2 — rules */}
      <section className="bg-ground-muted py-20 px-4 border-t border-rule">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight mb-4">
            FCC/TCPA legal compliance rules for running automated voice calls as a solo business in the US
          </h2>
          <p className="text-ink-secondary leading-relaxed mb-8 max-w-3xl">
            Plain-English summary for a solo operator — <strong>not legal advice</strong>. Compliance duties do
            not shrink because the business is one person; these are the rules that come up most, and the last
            item on this page tells you how to verify them for your specific case.
          </p>
          <ul className="space-y-5 max-w-3xl">
            {RULES.map((r) => (
              <li key={r.title} className="dp-card p-5">
                <h3 className="font-bold text-sm text-ink font-display mb-1">{r.title}</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">{r.body}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-secondary leading-relaxed mt-8 max-w-3xl">
            VerifyOne maps to this checklist directly: the gate checks declared consent, both DNC sets (US
            National DNC plus the Canadian DNCL), calling hours, reassigned-number risk, litigator history, and
            carrier status — and returns <strong>ALLOW, REVIEW, or DENY</strong> with a sealed, hash-chained
            evidence ID. It is fail-closed: missing data never quietly becomes allow.
          </p>
        </div>
      </section>

      {/* Section 3 — costs */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight mb-4">
            Average monthly costs of setting up a solo voice agent
          </h2>
          <p className="text-ink-secondary leading-relaxed mb-8 max-w-3xl">
            Short answer: plan for roughly <strong>$400 to $3,000 or more per month</strong> once a compliance
            gate is in the stack — call volume drives most of it. Here is the line-item breakdown for a solo
            operator dialing steadily in the US or Canada.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--theme-border-strong)' }}>
                  <th className="text-left py-3 pr-4 font-display font-bold text-ink">Line item</th>
                  <th className="text-left py-3 pr-4 font-display font-bold text-ink">Typical solo range / month</th>
                  <th className="text-left py-3 font-display font-bold text-ink">What drives it</th>
                </tr>
              </thead>
              <tbody>
                {COST_ROWS.map((c) => (
                  <tr key={c.item} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    <td className="py-3 pr-4 font-semibold text-ink align-top">{c.item}</td>
                    <td className="py-3 pr-4 text-ink-secondary align-top">{c.range}</td>
                    <td className="py-3 text-ink-secondary align-top">{c.driver}</td>
                  </tr>
                ))}
                <tr style={{ borderBottom: '2px solid var(--theme-border-strong)', background: 'var(--theme-accent-surface-subtle)' }}>
                  <td className="py-3 pr-4 font-bold text-ink align-top">Total, solo operator</td>
                  <td className="py-3 pr-4 font-bold text-ink align-top">~$400 – $3,000+</td>
                  <td className="py-3 font-semibold text-ink align-top">Mostly your call volume</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-secondary mt-4 leading-relaxed max-w-3xl">
            Ranges are typical published figures as of late 2026 — they shift with volume and vendors, so
            verify each vendor directly. The VerifyOne line is exact: it comes from the published plans on the
            pricing page. For scale: TCPA statutory damages run $500–$1,500 per call, text, or prerecorded
            message — the gate is usually cheaper than one bad dial.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ground-muted py-16 px-4 border-t border-rule">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold text-ink font-display tracking-tight mb-3">
            Put the gate in front of your agent
          </h2>
          <p className="text-ink-secondary mb-6 max-w-2xl mx-auto">
            One API call before every dial returns ALLOW or DENY with a typed reason and a sealed,
            hash-chained evidence record — on Vapi, Retell, or any platform that can make an HTTPS request.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/pricing" className="dp-btn-primary">See plans</Link>
            <Link href="/dashboard" className="dp-btn-secondary">Open dashboard</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-ink font-display tracking-tight mb-6">
            Solo voice agent FAQ
          </h2>
          <div>
            {FAQ_ITEMS.map((f, i) => (
              <div
                key={f.q}
                className="py-6"
                style={{
                  borderTop: i === 0 ? '1px solid var(--theme-border)' : 'none',
                  borderBottom: '1px solid var(--theme-border)',
                }}
              >
                <h3 className="font-semibold text-[17px] mb-2" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                  {f.q}
                </h3>
                <p className="text-[15px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
        {/* FAQPage JSON-LD — exact question strings */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
        />
      </section>

      {/* Disclaimer */}
      <section className="bg-ground-muted py-10 px-4 border-t border-rule">
        <p className="text-center text-xs text-ink-secondary max-w-2xl mx-auto leading-relaxed">
          This guide is general information, not legal advice, and it does not create an attorney-client
          relationship. Consent standards, calling hours, and registry obligations change and vary by state
          and country — confirm your specific use case with qualified counsel. VerifyOne provides compliance
          controls and audit evidence; it does not provide legal advice and does not guarantee regulatory
          outcomes.
        </p>
      </section>
    </main>
  );
}
