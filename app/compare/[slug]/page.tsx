import { notFound } from 'next/navigation';
import Link from 'next/link';
import { COMPARE } from '../../../lib/data/compare';

export function generateStaticParams() {
  return COMPARE.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const item = COMPARE.find((c) => c.slug === params.slug);
  if (!item) return {};
  return {
    title: `VerifyOne vs ${item.competitor} | Feature & Cost Comparison`,
    description: `Compare VerifyOne vs ${item.competitor}. See why agencies switch to VerifyOne for unified phone, email, and IP validation with rollover credits.`,
  };
}

export default function ComparePage({ params }: { params: { slug: string } }) {
  const item = COMPARE.find((c) => c.slug === params.slug);
  if (!item) return notFound();

  return (
    <div className="min-h-screen bg-ground text-ink">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-ink-secondary mb-6">
          <Link href="/" className="hover:text-ink transition-colors">Home</Link>
          <span>/</span>
          <span className="text-ink-secondary">Compare</span>
          <span>/</span>
          <span className="text-accent font-medium">vs {item.competitor}</span>
        </nav>

        <header className="text-center mb-12">
          <span className="inline-block rounded-full bg-accent/10 border border-accent/20 px-3.5 py-1 text-xs font-semibold text-accent uppercase tracking-wider mb-4">
            Competitor Benchmark
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
            VerifyOne vs {item.competitor}
          </h1>
          <p className="text-ink-secondary text-base sm:text-lg max-w-2xl mx-auto">
            A transparent feature-by-feature and pricing comparison for high-volume lead agencies and data teams.
          </p>
        </header>

        {/* Comparison Table */}
        <div className="dp-card overflow-hidden shadow-sm mb-12">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-ground-muted border-b border-rule">
                <th className="py-4 px-6 text-ink-secondary font-semibold text-xs uppercase tracking-wider">Feature / Metric</th>
                <th className="py-4 px-6 text-accent font-bold text-sm">VerifyOne</th>
                <th className="py-4 px-6 text-ink font-semibold text-sm">{item.competitor}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              <tr>
                <td className="py-4 px-6 text-ink font-medium">Pricing / 1,000 checks</td>
                <td className="py-4 px-6 text-accent font-bold font-mono">$2.00 - $4.95</td>
                <td className="py-4 px-6 text-ink-secondary font-mono">{item.pricePer1k.split('vs')[1] || '$5.00+'}</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-ink font-medium">Data Scope</td>
                <td className="py-4 px-6 text-ink font-medium">Phone + Email + IP + Domain (74 Products)</td>
                <td className="py-4 px-6 text-ink-secondary">Single vertical only</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-ink font-medium">Credit System</td>
                <td className="py-4 px-6 text-accent font-medium">Universal shared credits with 3-month rollover</td>
                <td className="py-4 px-6 text-ink-secondary">Per-API siloed plans, no rollover</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-ink font-medium">AI &amp; Agent Native</td>
                <td className="py-4 px-6 text-ink font-medium">Official MCP Server (Claude/Cursor)</td>
                <td className="py-4 px-6 text-ink-secondary">Not available</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-ink font-medium">Bulk CSV Engine</td>
                <td className="py-4 px-6 text-ink font-medium">Built-in up to millions of rows</td>
                <td className="py-4 px-6 text-ink-secondary">Requires custom code or add-on</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Breakdown Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="rounded-panel border-2 border-accent/30 bg-accent/5 p-6 shadow-sm">
            <h3 className="font-bold text-ink text-base mb-2 font-display">Why Switch to VerifyOne</h3>
            <p className="text-sm text-ink-secondary leading-relaxed">{item.verifyOne}</p>
          </div>
          <div className="dp-card p-6">
            <h3 className="font-bold text-ink text-base mb-2 font-display">Limitations of {item.competitor}</h3>
            <p className="text-sm text-ink-secondary leading-relaxed">{item.competitorNote}</p>
          </div>
        </div>

        {/* Other Comparisons Grid */}
        <section className="border-t border-rule pt-10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-secondary mb-4 font-display">
            Compare other alternatives
          </h3>
          <div className="flex flex-wrap gap-2">
            {COMPARE.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className={`text-xs px-3.5 py-2 rounded-lg border transition-all duration-160 ${
                  c.slug === item.slug
                    ? 'border-accent text-accent bg-accent/10 font-bold'
                    : 'border-rule bg-panel text-ink-secondary hover:text-ink hover:border-rule'
                }`}
              >
                vs {c.competitor}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
