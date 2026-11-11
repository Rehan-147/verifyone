import type { ReactNode } from 'react';
import Link from 'next/link';
import { PLANS } from '../../lib/plans';

const GUIDE_HREF = '/guides/solo-ai-voice-outbound';
const GUIDE_LINK_STYLE = { color: 'var(--theme-brand)' } as const;

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'What is VerifyOne?',
    a: 'VerifyOne is a pre-action compliance gate for AI calling and messaging agents. It returns an auditable decision before an agent dials or sends.',
  },
  {
    q: 'Does VerifyOne replace my dialer or AI platform?',
    a: 'No. It sits between your agent and the outbound action. Your platform still makes the call; VerifyOne helps decide whether the action should happen.',
  },
  {
    q: 'What decisions does VerifyOne return?',
    a: 'Allow, review, or block, with a reason and evidence ID. The live v1 API expresses this as ALLOW or DENY with a typed reason code — see the decision mapping in the docs.',
  },
  {
    q: 'Does VerifyOne guarantee I will not be fined?',
    a: 'No. VerifyOne provides compliance controls and audit evidence. It does not provide legal advice or guarantee regulatory outcomes.',
  },
  {
    q: 'Which countries are supported?',
    a: 'The initial focus is U.S. phone numbers. Canada, the U.K., Australia, and Ireland are expansion candidates. EU support is not generally available.',
  },
  {
    q: 'Does VerifyOne work with Vapi, Retell, or Bland?',
    a: 'VerifyOne is API- and MCP-first. It can be added to agent workflows through REST, webhooks, custom functions, or MCP where the platform supports them.',
  },
  {
    q: 'What happens if a data source is unavailable?',
    a: 'VerifyOne follows a fail-safe policy. Missing or unavailable checks do not silently become allow; they result in review or block according to the configured policy.',
  },
  // Solo-operator guide entries — questions are the exact SEO strings; answers
  // mirror the FAQPage JSON-LD on /guides/solo-ai-voice-outbound.
  {
    q: 'Top beginner-friendly AI voice agent platforms used by solo operators',
    a: (
      <>
        The usual first picks are Vapi, Retell AI, Bland AI, and Synthflow — Vapi and Retell for hands-on
        builders, Synthflow for no-code. Compare them in the{' '}
        <Link href={GUIDE_HREF} style={GUIDE_LINK_STYLE}>solo AI voice guide</Link>.
      </>
    ),
  },
  {
    q: 'FCC/TCPA legal compliance rules for running automated voice calls as a solo business in the US',
    a: (
      <>
        Solo businesses carry the same core obligations as any telemarketer: prior express written consent for
        AI or prerecorded calls to wireless numbers, National Do Not Call Registry scrubbing (plus the Canadian
        DNCL if you call Canada), calling-hours limits, reassigned-number checks, and accurate caller ID. The{' '}
        <Link href={GUIDE_HREF} style={GUIDE_LINK_STYLE}>solo compliance guide</Link> walks through each rule —
        it is not legal advice.
      </>
    ),
  },
  {
    q: 'Average monthly costs of setting up a solo voice agent',
    a: (
      <>
        Most solo setups run from a few hundred to about $3,000 per month: platform usage scales with minutes,
        phone numbers cost a few dollars, registry checks vary by vendor, and the VerifyOne gate starts at
        ${PLANS.STARTER.priceUsd}/mo (Starter). The{' '}
        <Link href={GUIDE_HREF} style={GUIDE_LINK_STYLE}>cost table in the solo guide</Link> has every line item.
      </>
    ),
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20" style={{ padding: 'var(--spacing6) 0', background: 'var(--theme-page-alt)' }}>
      <div className="container" style={{ maxWidth: 880 }}>
        {/* Caution FAQ: large centered title, quiet border-top rows */}
        <span className="eyebrow" style={{ textAlign: 'center' }}>FAQ</span>
        <h2
          className="landing-section-title"
          style={{ textAlign: 'center', margin: '0 auto var(--spacing6)', maxWidth: '30rem' }}
        >
          Frequently asked questions
        </h2>

        <div>
          {FAQS.map((faq, i) => (
            <div
              key={faq.q}
              className="py-6"
              style={{ borderTop: i === 0 ? '1px solid var(--theme-border)' : 'none', borderBottom: '1px solid var(--theme-border)' }}
            >
              <h3 className="font-semibold text-[17px] mb-2" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                {faq.q}
              </h3>
              <p className="text-[15px] leading-relaxed max-w-3xl" style={{ color: 'var(--theme-text-secondary)' }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
