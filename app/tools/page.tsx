import Link from 'next/link';
import { TOOLS } from '../../lib/data/tools';

export const metadata = {
  title: 'Free SEO Validation & Intelligence Tools | VerifyOne',
  description: 'Explore 20+ free developer and agency tools for phone carrier lookups, email verification, IP fraud detection, and domain intelligence.',
};

export default function ToolsIndexPage() {
  const categories = Array.from(new Set(TOOLS.map((t) => t.category)));

  return (
    <div className="min-h-screen bg-ground text-ink">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <header className="text-center mb-16">
          <span className="inline-block rounded-full bg-accent/10 border border-accent/20 px-4 py-1 text-xs font-semibold text-accent tracking-widest uppercase mb-4">
            Free Developer Suite
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
            20+ Free Validation &amp; Intelligence Tools
          </h1>
          <p className="text-ink-secondary text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Run single checks directly in your browser with zero sign-up, or use the unified API to verify at scale.
          </p>
        </header>

        {categories.map((cat) => {
          const catTools = TOOLS.filter((t) => t.category === cat);
          return (
            <section key={cat} className="mb-14">
              <h2 className="text-lg font-bold uppercase tracking-wider text-ink font-display border-b border-rule pb-3 mb-6 flex items-center justify-between">
                <span>{cat} Tools</span>
                <span className="text-xs bg-ground-muted border border-rule px-2.5 py-0.5 rounded-full font-mono text-ink-secondary">
                  {catTools.length} Tools
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catTools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group dp-card hover:border-accent/40 p-6 transition-all duration-160 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-ground-muted border border-rule text-ink-secondary uppercase">
                          {tool.inputType}
                        </span>
                        <span className="text-xs text-ink-secondary/70 font-mono">
                          {tool.searchVolume}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-ink font-display group-hover:text-accent transition-colors mb-2">
                        {tool.title}
                      </h3>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-rule/50 flex items-center text-xs font-semibold text-accent">
                      <span>Open Free Tool</span>
                      <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
