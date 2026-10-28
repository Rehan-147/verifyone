import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TOOLS } from '../../../lib/data/tools';
import ToolChecker from '../../../components/ToolChecker';

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const tool = TOOLS.find((t) => t.slug === params.slug);
  if (!tool) return {};
  return {
    title: tool.seoTitle,
    description: tool.description,
  };
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = TOOLS.find((t) => t.slug === params.slug);
  if (!tool) return notFound();

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/tools" className="hover:text-white transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-[#A3E635]">{tool.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-10 text-center">
          <span className="inline-block rounded-full bg-[#A3E635]/10 border border-[#A3E635]/30 px-3.5 py-1 text-xs font-semibold text-[#A3E635] uppercase tracking-wider mb-4">
            Free Online Tool · {tool.category.toUpperCase()}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            {tool.title}
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {tool.description}. Free single query online or programmatic via unified API.
          </p>
        </header>

        {/* Live Interactive Tool Checker */}
        <div className="mb-16">
          <ToolChecker type={tool.inputType} toolTitle={tool.title} />
        </div>

        {/* How It Works Section */}
        <section className="mb-16 rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-bold mb-4 text-white">How {tool.title} Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-300">
            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
              <span className="font-mono text-[#A3E635] text-lg font-bold block mb-2">01. Query</span>
              <p className="text-xs text-gray-400">
                Pings real-time telecom switches, authoritative MX records, or network registries.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
              <span className="font-mono text-[#A3E635] text-lg font-bold block mb-2">02. Inspect</span>
              <p className="text-xs text-gray-400">
                Analyzes carrier routing, active porting, fraud risk flags, and disposable indicators.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
              <span className="font-mono text-[#A3E635] text-lg font-bold block mb-2">03. Return</span>
              <p className="text-xs text-gray-400">
                Produces normalized results instantly in under 300 milliseconds.
              </p>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions (FAQ) */}
        {tool.faq && tool.faq.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-white">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {tool.faq.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-semibold text-white text-base mb-2">{item.q}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Call to Action Banner */}
        <section className="rounded-2xl border border-[#A3E635]/30 bg-[#A3E635]/10 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Need to verify millions of rows in bulk?</h2>
          <p className="text-gray-300 text-sm max-w-xl mx-auto mb-6">
            Use the VerifyOne Dashboard to upload CSVs, automate with Zapier/n8n, or plug into your application with a single API key.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-xl bg-[#A3E635] hover:bg-[#bef264] text-black font-bold px-6 py-3 text-sm transition-colors shadow-lg"
            >
              Open Bulk Dashboard
            </Link>
            <Link
              href="/tools"
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 text-sm transition-colors"
            >
              Explore Other Tools
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
