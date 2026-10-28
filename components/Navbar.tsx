'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TOOLS } from '../lib/data/tools';
import { INTEGRATIONS } from '../lib/integrations/catalog-100';

export default function Navbar() {
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 bg-panel border-b border-rule"
      style={{ transition: `box-shadow 160ms ease-out` }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          >
            <span
              className="text-xl font-bold tracking-tight text-ink"
              style={{ fontFamily: '"Host Grotesk", sans-serif', letterSpacing: '-0.03em' }}
            >
              Verify<span className="text-accent">One</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-semibold tracking-widest px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              API
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-ink-secondary">
            {/* Free Tools dropdown */}
            <div className="relative">
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                onBlur={() => setTimeout(() => setToolsOpen(false), 200)}
                aria-expanded={toolsOpen}
                aria-haspopup="true"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-ground-muted hover:text-ink transition-[background,color] duration-[160ms] ease-out focus-visible:outline-accent focus-visible:outline-2"
              >
                Free Tools
                <span className="font-mono text-[11px] text-accent font-semibold">({TOOLS.length})</span>
                <svg
                  className={`w-3.5 h-3.5 text-ink-secondary transition-transform duration-[160ms] ease-out ${toolsOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {toolsOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto dp-card z-50 py-1">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-ink-secondary border-b border-rule">
                    Free Online Tools
                  </div>
                  {TOOLS.map((tool) => (
                    <Link
                      key={tool.slug}
                      href={`/tools/${tool.slug}`}
                      className="flex items-center justify-between px-3 py-2 text-[13px] text-ink-secondary hover:bg-ground-muted hover:text-ink transition-colors duration-[160ms]"
                    >
                      <span className="truncate">{tool.title}</span>
                      <span className="ml-2 shrink-0 text-[11px] font-mono text-ink-secondary opacity-60">{tool.searchVolume}</span>
                    </Link>
                  ))}
                  <div className="border-t border-rule mt-1 pt-1">
                    <Link
                      href="/tools"
                      className="block px-3 py-2 text-[13px] font-semibold text-accent hover:bg-ground-muted transition-colors duration-[160ms]"
                    >
                      View all {TOOLS.length} tools →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {[
              { href: '/integrations', label: 'Integrations', badge: `${INTEGRATIONS.length}` },
              { href: '/compare/twilio', label: 'Compare', badge: null },
              { href: '/#pricing', label: 'Pricing', badge: null },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-ground-muted hover:text-ink transition-[background,color] duration-[160ms] ease-out focus-visible:outline-accent focus-visible:outline-2"
              >
                {link.label}
                {link.badge && (
                  <span className="font-mono text-[11px] text-ink-secondary bg-ground-muted border border-rule px-1.5 py-0.5 rounded-full">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden sm:inline-flex items-center px-3 py-2 rounded-md text-sm font-semibold text-ink-secondary hover:bg-ground-muted hover:text-ink transition-[background,color] duration-[160ms] ease-out focus-visible:outline-accent focus-visible:outline-2"
          >
            Dashboard
          </Link>
          <Link href="/dashboard" className="dp-btn-primary text-sm whitespace-nowrap">
            Get Free API Key
          </Link>
        </div>
      </div>
    </header>
  );
}
