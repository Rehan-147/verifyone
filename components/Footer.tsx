import Link from 'next/link';
import { TOOLS } from '../lib/data/tools';
import { COMPARE } from '../lib/data/compare';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-field text-on-field-secondary py-16 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand */}
        <div className="space-y-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-on-field font-display inline-block">
            Verify<span className="text-accent">One</span>
          </Link>
          <p className="text-sm leading-relaxed text-on-field-secondary">
            One unified validation API for phone, email, and IP intelligence. 74+ data products under one credit balance.
          </p>
          <p className="text-xs text-on-field-secondary/70">
            © {new Date().getFullYear()} VerifyOne Technologies Inc. All rights reserved.
          </p>
        </div>

        {/* Free SEO Tools */}
        <div>
          <h3 className="text-xs font-bold text-on-field tracking-wider uppercase mb-4 font-display">
            Popular Free Tools
          </h3>
          <ul className="space-y-2 text-xs">
            {TOOLS.slice(0, 8).map((tool) => (
              <li key={tool.slug}>
                <Link href={`/tools/${tool.slug}`} className="hover:text-on-field transition-colors">
                  {tool.title}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <Link href="/tools" className="text-accent font-semibold hover:underline">
                View all 20 free SEO tools →
              </Link>
            </li>
          </ul>
        </div>

        {/* Competitor Comparisons */}
        <div>
          <h3 className="text-xs font-bold text-on-field tracking-wider uppercase mb-4 font-display">
            Compare VerifyOne
          </h3>
          <ul className="space-y-2 text-xs">
            {COMPARE.map((item) => (
              <li key={item.slug}>
                <Link href={`/compare/${item.slug}`} className="hover:text-on-field transition-colors">
                  vs {item.competitor}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Platform & Integrations */}
        <div>
          <h3 className="text-xs font-bold text-on-field tracking-wider uppercase mb-4 font-display">
            Platform & Integrations
          </h3>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/integrations" className="hover:text-on-field transition-colors">
                100+ Integrations Catalog
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-on-field transition-colors">
                Client Dashboard & API Keys
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="hover:text-on-field transition-colors">
                Pricing & Credit Packs
              </Link>
            </li>
            <li>
              <Link href="/api/mcp" className="hover:text-on-field transition-colors">
                Model Context Protocol (MCP) Server
              </Link>
            </li>
            <li className="pt-2">
              <span className="text-on-field-secondary/60 font-mono text-[11px] block border border-white/10 rounded px-2.5 py-1 w-fit bg-white/5">
                ● System Status: 99.98% Normal
              </span>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
