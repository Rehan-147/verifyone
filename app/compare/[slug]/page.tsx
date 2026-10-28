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
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-gray-400">Compare</span>
          <span>/</span>
          <span className="text-[#A3E635]">vs {item.competitor}</span>
        </nav>

        <header className="text-center mb-12">
          <span className="inline-block rounded-full bg-[#A3E635]/10 border border-[#A3E635]/30 px-3.5 py-1 text-xs font-semibold text-[#A3E635] uppercase tracking-wider mb-4">
            Competitor Benchmark
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
            VerifyOne vs {item.competitor}
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            A transparent feature-by-feature and pricing comparison for high-volume lead agencies.
          </p>
        </header>

        {/* Comparison Table */}
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl mb-12">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="py-4 px-6 text-gray-400 font-semibold">Feature / Metric</th>
                <th className="py-4 px-6 text-[#A3E635] font-bold">VerifyOne</th>
                <th className="py-4 px-6 text-gray-300 font-semibold">{item.competitor}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-4 px-6 text-gray-300 font-medium">Pricing / 1,000 checks</td>
                <td className="py-4 px-6 text-[#A3E635] font-bold font-mono">$2.00 - $4.95</td>
                <td className="py-4 px-6 text-gray-400 font-mono">{item.pricePer1k.split('vs')[1] || '$5.00+'}</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300 font-medium">Data Scope</td>
                <td className="py-4 px-6 text-white font-medium">Phone + Email + IP + Domain (74 Products)</td>
                <td className="py-4 px-6 text-gray-400">Single vertical only</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300 font-medium">Credit System</td>
                <td className="py-4 px-6 text-[#A3E635] font-medium">Universal shared credits with 3-month rollover</td>
                <td className="py-4 px-6 text-gray-400">Per-API siloed plans, no rollover</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300 font-medium">AI & Agent Native</td>
                <td className="py-4 px-6 text-white font-medium">Official MCP Server (Claude/Cursor)</td>
                <td className="py-4 px-6 text-gray-400">Not available</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-300 font-medium">Bulk CSV Engine</td>
                <td className="py-4 px-6 text-white font-medium">Built-in up to millions of rows</td>
                <td className="py-4 px-6 text-gray-400">Requires custom code or add-on</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Breakdown Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="rounded-xl border border-[#A3E635]/30 bg-[#A3E635]/5 p-6">
            <h3 className="font-bold text-white text-base mb-2">Why Switch to VerifyOne</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{item.verifyOne}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-bold text-gray-300 text-base mb-2">Limitations of {item.competitor}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{item.competitorNote}</p>
          </div>
        </div>

        {/* Other Comparisons Grid */}
        <section className="border-t border-white/10 pt-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Compare other alternatives
          </h3>
          <div className="flex flex-wrap gap-2">
            {COMPARE.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  c.slug === item.slug
                    ? 'border-[#A3E635] text-[#A3E635] bg-[#A3E635]/10 font-bold'
                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
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
