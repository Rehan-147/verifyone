'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TOOLS } from '../lib/data/tools';
import { INTEGRATIONS } from '../lib/integrations/catalog-100';

export default function Navbar() {
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0F1E]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              Verify<span className="text-[#A3E635]">One</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/20">
              API
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
            {/* Free Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                onBlur={() => setTimeout(() => setToolsOpen(false), 200)}
                className="hover:text-white flex items-center gap-1.5 transition-colors py-2"
              >
                <span>Free SEO Tools</span>
                <span className="text-xs text-[#A3E635]">({TOOLS.length})</span>
                <svg className={`w-4 h-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {toolsOpen && (
                <div className="absolute top-full left-0 w-80 max-h-96 overflow-y-auto bg-[#0d1527] border border-white/10 rounded-xl shadow-2xl p-2 grid grid-cols-1 gap-1 z-50">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-white/5">
                    Popular Free Tools
                  </div>
                  {TOOLS.map((tool) => (
                    <Link
                      key={tool.slug}
                      href={`/tools/${tool.slug}`}
                      className="px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-gray-300 hover:text-[#A3E635] transition-colors flex justify-between items-center"
                    >
                      <span className="truncate">{tool.title}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{tool.searchVolume}</span>
                    </Link>
                  ))}
                  <Link
                    href="/tools"
                    className="mt-1 pt-2 border-t border-white/5 text-center text-xs font-semibold text-[#A3E635] hover:underline block py-1"
                  >
                    View All {TOOLS.length} Free Tools →
                  </Link>
                </div>
              )}
            </div>

            <Link href="/tools" className="hover:text-white transition-colors">
              Tools Catalog
            </Link>
            <Link href="/integrations" className="hover:text-white transition-colors flex items-center gap-1.5">
              <span>Integrations</span>
              <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded-full font-mono">
                {INTEGRATIONS.length}
              </span>
            </Link>
            <Link href="/compare/twilio" className="hover:text-white transition-colors">
              Compare
            </Link>
            <Link href="/#pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-gray-300 hover:text-white transition-colors hidden sm:block"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#A3E635] hover:bg-[#bef264] text-black font-bold px-4 py-2 text-sm transition-colors shadow-sm"
          >
            Get Free API Key
          </Link>
        </div>
      </div>
    </header>
  );
}
