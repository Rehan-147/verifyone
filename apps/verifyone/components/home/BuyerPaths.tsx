import Link from 'next/link';

const PATHS = [
  {
    title: 'For AI voice-agent agencies',
    body: 'Launch client campaigns with a reusable compliance gate, per-client evidence, and clear block reasons.',
    cta: 'Book an agency walkthrough',
    href: '/for-agents',
  },
  {
    title: 'For lead-gen and home-services teams',
    body: 'Gate AI calls before they reach consumers, reduce wasted dialer activity, and keep campaign-level audit records.',
    cta: 'Start a pilot',
    href: '/dashboard',
  },
  {
    title: 'For developers and AI platforms',
    body: 'Embed one pre-action compliance API or MCP tool into any agent workflow.',
    cta: 'Read the docs',
    href: '/docs',
  },
];

export default function BuyerPaths() {
  return (
    <section style={{ padding: 'var(--spacing6) 0' }}>
      <div className="container">
        <span className="eyebrow">Who it&apos;s for</span>
        <h2 className="landing-section-title">Built for teams that cannot afford risky outreach.</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PATHS.map((p) => (
            <div key={p.title} className="dp-card p-7 flex flex-col">
              <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                {p.title}
              </h3>
              <p className="text-[15px] leading-relaxed flex-1" style={{ color: 'var(--theme-text-secondary)' }}>
                {p.body}
              </p>
              <Link
                href={p.href}
                className="cta-link mt-6"
                style={{ padding: 0, minHeight: 0, fontSize: '0.95rem', color: 'var(--theme-brand)' }}
              >
                {p.cta}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
