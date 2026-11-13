import Link from 'next/link';

// No testimonials, logos, ratings, or usage counts are shown — there are no
// announced customers yet. Only neutral, verifiable product facts plus the
// design-partner program.
const PROOF_POINTS = [
  { title: 'Live API status', body: 'The gate endpoints run on this deployment and answer with real decisions, not canned fixtures.' },
  { title: 'MCP endpoint available', body: 'A working MCP server at /api/mcp exposes the gate to any MCP-compatible agent client.' },
  { title: 'U.S. phone coverage first', body: 'Checks are built around U.S. numbering, registries, and calling-hour rules. Other regions are roadmap, not live.' },
];

export default function Proof() {
  return (
    <section style={{ padding: 'var(--spacing6) 0', background: 'var(--theme-page-alt)' }}>
      <div className="container">
        <span className="eyebrow">Proof</span>
        <h2 className="landing-section-title">Built for teams that need evidence, not guesswork.</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {PROOF_POINTS.map((p) => (
            <div key={p.title} className="dp-card px-6 py-5">
              <h3 className="font-semibold text-[15px] mb-1.5" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>{p.body}</p>
            </div>
          ))}
        </div>

        {/* Design partners */}
        <div className="dp-card p-8 md:p-10">
          <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
            Design partners
          </h3>
          <p className="text-[15px] leading-relaxed mb-6 max-w-2xl" style={{ color: 'var(--theme-text-secondary)' }}>
            We are onboarding a small group of AI-calling teams as design partners. Pilot customers receive
            direct support, integration help, and input into the compliance-rule roadmap.
          </p>
          <Link href="/dashboard" className="cta-btn">Apply for a design-partner pilot</Link>
          <p className="text-xs mt-4" style={{ color: 'var(--theme-text-faint)' }}>
            Applying starts with a free account — you can talk to us from there.
          </p>
        </div>
      </div>
    </section>
  );
}
