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
    <div className="min-h-screen bg-ground text-ink">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-ink-secondary mb-6">
          <Link href="/" className="hover:text-ink transition-colors">Home</Link>
          <span>/</span>
          <Link href="/tools" className="hover:text-ink transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-accent font-medium">{tool.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-10 text-center">
          <span className="inline-block rounded-full bg-accent/10 border border-accent/20 px-3.5 py-1 text-xs font-semibold text-accent uppercase tracking-wider mb-4">
            Free Online Tool · {tool.category.toUpperCase()}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-ink font-display mb-4">
            {tool.title}
          </h1>
          <p className="text-ink-secondary text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {tool.description}. Free single query online or programmatic via unified API.
          </p>
        </header>

        {/* Live Interactive Tool Checker */}
        <div className="mb-16">
          <ToolChecker type={tool.inputType} toolTitle={tool.title} />
        </div>

        {/* How It Works Section */}
        <section className="mb-16 rounded-panel border border-rule bg-ground-muted p-8">
          <h2 className="text-xl font-bold mb-4 text-ink font-display">How {tool.title} Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-ink-secondary">
            <div className="p-5 rounded-panel bg-panel border border-rule shadow-sm">
              <span className="font-mono text-accent text-lg font-bold block mb-2 font-display">01. Query</span>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Pings real-time telecom switches, authoritative MX records, or network registries.
              </p>
            </div>
            <div className="p-5 rounded-panel bg-panel border border-rule shadow-sm">
              <span className="font-mono text-accent text-lg font-bold block mb-2 font-display">02. Inspect</span>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Analyzes carrier routing, active porting, fraud risk flags, and disposable indicators.
              </p>
            </div>
            <div className="p-5 rounded-panel bg-panel border border-rule shadow-sm">
              <span className="font-mono text-accent text-lg font-bold block mb-2 font-display">03. Return</span>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Produces normalized results instantly in under 300 milliseconds.
              </p>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions (FAQ) */}
        {tool.faq && tool.faq.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-ink font-display">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {tool.faq.map((item, idx) => (
                <div key={idx} className="dp-card p-5">
                  <h3 className="font-bold text-ink text-sm sm:text-base mb-2 font-display">{item.q}</h3>
                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Call to Action Banner (Dark Field) */}
        <section className="rounded-panel border border-rule bg-field text-on-field p-8 sm:p-10 text-center shadow-md">
          <h2 className="text-2xl font-bold text-on-field font-display mb-2">Need to verify millions of rows in bulk?</h2>
          <p className="text-on-field-secondary text-sm max-w-xl mx-auto mb-6">
            Use the VerifyOne Dashboard to upload CSVs, automate with Zapier/n8n, or plug into your application with a single API key.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/dashboard"
              className="dp-btn-primary px-6 py-3 text-sm text-center"
            >
              Open Bulk Dashboard
            </Link>
            <Link
              href="/tools"
              className="rounded-lg bg-white/10 hover:bg-white/20 text-on-field font-semibold px-6 py-3 text-sm transition-colors text-center"
            >
              Explore Other Tools
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
