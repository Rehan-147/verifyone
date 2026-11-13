'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/#product', label: 'Product' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/for-platforms', label: 'For AI platforms' },
  { href: '/for-agents', label: 'For agencies' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
];

const RESOURCE_LINKS = [
  { href: '/docs', label: 'Documentation' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/tools', label: 'Free tools' },
  { href: '/security', label: 'Security' },
  { href: '/status', label: 'API status' },
];

const linkClass =
  'px-3 py-2 rounded-md text-sm font-normal transition-colors hover:bg-[var(--theme-hover)] focus-visible:outline-2 focus-visible:outline-[var(--theme-focus)]';
const linkStyle = { color: 'var(--theme-text-secondary)' } as const;

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Navbar() {
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('verifyone-theme') !== 'dark') return;
    setDark(true);
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('verifyone-theme', next ? 'dark' : 'light');
  }

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'var(--theme-surface-translucent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="container flex items-center justify-between gap-4" style={{ height: 72 }}>
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 rounded focus-visible:outline-2 focus-visible:outline-[var(--theme-focus)]"
        >
          <span
            className="text-xl font-semibold tracking-tight"
            style={{
              letterSpacing: '-0.02em',
              color: 'var(--theme-text-primary)',
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            }}
          >
            Verify<span style={{ color: 'var(--theme-brand)' }}>One</span>
          </span>
        </Link>

        <nav className="hidden xl:flex items-center" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass} style={linkStyle}>
              {l.label}
            </Link>
          ))}

          <div className="relative">
            <button
              type="button"
              aria-expanded={resourcesOpen}
              aria-haspopup="true"
              onClick={() => setResourcesOpen((v) => !v)}
              onBlur={() => setTimeout(() => setResourcesOpen(false), 180)}
              className={linkClass}
              style={linkStyle}
            >
              Resources
              <svg
                className={`inline w-3.5 h-3.5 ml-1 transition-transform ${resourcesOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {resourcesOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-56 rounded-md border py-1 z-50"
                style={{
                  background: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                  boxShadow: 'var(--theme-shadow)',
                }}
              >
                {RESOURCE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block px-4 py-2 text-sm transition-colors hover:bg-[var(--theme-hover)]"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden xl:flex items-center gap-2">
          <button
            type="button"
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-pressed={dark}
            onClick={toggleTheme}
            className="rounded-md p-2 transition-colors hover:bg-[var(--theme-hover)]"
            style={linkStyle}
          >
            <MoonIcon className="w-4.5 h-4.5" />
          </button>
          <Link
            href="/dashboard"
            className="px-3 py-2 text-sm font-normal transition-colors hover:bg-[var(--theme-hover)] rounded-md"
            style={linkStyle}
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="cta-btn"
            style={{ fontSize: '0.95rem', padding: '10px 22px' }}
          >
            Test the Pre-Dial Gate
          </Link>
        </div>

        <div className="flex xl:hidden items-center gap-1">
          <button
            type="button"
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
            className="rounded-md p-2"
            style={linkStyle}
          >
            <MoonIcon />
          </button>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-2"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={menuOpen ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'}
              />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-nav"
          className="xl:hidden border-t"
          style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
        >
          <div className="container py-4 flex flex-col gap-1">
            {[...NAV_LINKS, ...RESOURCE_LINKS].map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-md text-sm transition-colors hover:bg-[var(--theme-hover)]"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="cta-btn mt-2"
              style={{ fontSize: '0.95rem' }}
            >
              Test the Pre-Dial Gate
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
