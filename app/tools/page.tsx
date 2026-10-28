import Link from 'next/link';
import { TOOLS } from '../../lib/data/tools';

export const metadata = {
  title: 'Free SEO Validation & Intelligence Tools | VerifyOne',
  description: 'Explore 20+ free developer and agency tools for phone carrier lookups, email verification, IP fraud detection, and domain intelligence.',
};

export default function ToolsIndexPage() {
  const categories = Array.from(new Set(TOOLS.map((t) => t.category)));

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <header className="text-center mb-16">
          <span className="inline-block rounded-full bg-[#A3E635]/10 border border-[#A3E635]/30 px-4 py-1 text-xs font-semibold text-[#A3E635] tracking-widest uppercase mb-4">
            Free Developer Suite
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            20+ Free Validation &amp; Intelligence Tools
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Run single checks directly in your browser with zero sign-up, or use the unified API to verify at scale.
          </p>
        </header>

        {categories.map((cat) => {
          const catTools = TOOLS.filter((t) => t.category === cat);
          return (
            <section key={cat} className="mb-14">
              <h2 className="text-xl font-bold uppercase tracking-wider text-gray-300 border-b border-white/10 pb-3 mb-6 flex items-center gap-2">
                <span>{cat} Tools</span>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full font-mono text-[#A3E635]">
                  {catTools.length}
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catTools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group rounded-2xl border border-white/10 bg-white/5 hover:border-[#A3E635]/50 hover:bg-[#A3E635]/5 p-6 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300 group-hover:text-[#A3E635] uppercase">
                          {tool.inputType}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {tool.searchVolume}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-white group-hover:text-[#A3E635] transition-colors mb-2">
                        {tool.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center text-xs font-semibold text-[#A3E635]">
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
