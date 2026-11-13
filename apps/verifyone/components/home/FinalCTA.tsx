import Link from 'next/link';

// Caution cta-section-block: centered statement + single dark pill CTA.
export default function FinalCTA() {
  return (
    <section style={{ padding: 'var(--spacing6-5) 0' }}>
      <div className="container" style={{ maxWidth: 720, textAlign: 'center' }}>
        <h2 className="landing-section-title" style={{ margin: '0 auto var(--spacing4)' }}>
          Put a compliance gate before your AI agent dials.
        </h2>
        <p className="section-lede" style={{ margin: '0 auto var(--spacing5)' }}>
          Test the pre-dial gate, get an API key, and keep an auditable record of every outbound decision.
        </p>
        <Link href="/dashboard" className="cta-btn">Test the Pre-Dial Gate</Link>
      </div>
    </section>
  );
}
