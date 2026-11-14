import Link from 'next/link';
import { TOOLS } from '../lib/data/tools';

const COL_LINK = 'transition-colors hover:text-[var(--theme-brand)]';
const COL_STYLE = { color: 'var(--theme-text-secondary)' } as const;
const HEADING = 'text-xs font-medium uppercase tracking-wider mb-4';
const HEADING_STYLE = {
  color: 'var(--theme-text-faint)',
  fontFamily: 'ui-monospace, monospace',
} as const;

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/docs#pre-dial-phone-gate', label: 'Pre-Dial Gate' },
      { href: '/docs#pre-dial-phone-gate', label: 'API' },
      { href: '/docs#mcp-server', label: 'MCP Server' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'For teams',
    links: [
      { href: '/for-agents', label: 'AI voice-agent agencies' },
      { href: '/for-agents', label: 'Lead-generation teams' },
      { href: '/for-agents', label: 'Home services' },
      { href: '/for-agents', label: 'Insurance' },
      { href: '/for-platforms', label: 'Contact centers' },
      { href: '/docs', label: 'Developers' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/guides/solo-ai-voice-outbound', label: 'Solo AI voice guide' },
      { href: '/docs', label: 'Documentation' },
      { href: '/status', label: 'API status' },
      { href: '/security', label: 'Security' },
      { href: '/tools', label: 'Free tools' },
      { href: '/compare/twilio', label: 'Comparisons' },
      { href: '/integrations', label: 'Integrations' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Terms of service' },
      { href: '/legal/acceptable-use', label: 'Acceptable use' },
      { href: '/legal/compliance-disclaimer', label: 'Compliance disclaimer' },
      { href: '/legal/data-processing', label: 'Data processing' },
    ],
  },
];

const TOOL_LINKS = [
  { slug: 'free-carrier-lookup', label: 'Free Phone Carrier Lookup' },
  { slug: 'free-hlr-lookup', label: 'Free HLR Lookup' },
  { slug: 'free-voip-checker', label: 'Free VoIP Checker' },
  { slug: 'free-email-verifier', label: 'Free Email Verifier' },
  { slug: 'free-ip-lookup', label: 'Free IP Lookup' },
  { slug: 'free-phone-validator', label: 'Free Phone Validator' },
  { slug: 'reverse-phone-lookup', label: 'Reverse Phone Lookup' },
  { slug: 'who-called-me', label: 'Who Called Me?' },
  { slug: 'area-code-lookup', label: 'Area Code Lookup' },
  { slug: 'phishing-email-checker', label: 'Phishing Email Checker' },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--theme-border)', background: 'var(--theme-page)' }}>
      <div
        className="container"
        style={{ padding: 'var(--spacing6) clamp(20px, 4vw, 48px) var(--spacing5)' }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">
          <div className="col-span-2 space-y-4">
            <Link
              href="/"
              className="text-xl font-semibold tracking-tight inline-block"
              style={{
                letterSpacing: '-0.02em',
                color: 'var(--theme-text-primary)',
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              }}
            >
              Verify<span style={{ color: 'var(--theme-brand)' }}>One</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--theme-text-muted)' }}>
              The pre-action compliance gate for AI calling and messaging agents. One API call before
              every dial or send returns an auditable allow, review, or block decision.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className={HEADING} style={HEADING_STYLE}>
                {col.title}
              </h3>
              <ul className="space-y-2.5 text-[13px]">
                {col.links.map((l) => (
                  <li key={col.title + l.label}>
                    <Link href={l.href} className={COL_LINK} style={COL_STYLE}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                {col.title === 'Resources' && (
                  <li
                    style={{ color: 'var(--theme-text-faint)', opacity: 0.6, cursor: 'default' }}
                    aria-disabled="true"
                  >
                    Blog — coming soon
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 'var(--spacing5)',
            paddingTop: 'var(--spacing4)',
            borderTop: '1px solid var(--theme-border)',
          }}
        >
          <p
            className="text-[11px] font-medium uppercase tracking-widest mb-3"
            style={HEADING_STYLE}
          >
            Free lookup tools
          </p>
          <div
            className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            {TOOL_LINKS.map((t) => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className={COL_LINK}>
                {t.label}
              </Link>
            ))}
            <Link
              href="/tools"
              className="font-medium hover:underline"
              style={{ color: 'var(--theme-brand)' }}
            >
              All {TOOLS.length} tools
            </Link>
          </div>
        </div>

        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
          style={{
            marginTop: 'var(--spacing5)',
            paddingTop: 'var(--spacing4)',
            borderTop: '1px solid var(--theme-border)',
            color: 'var(--theme-text-faint)',
          }}
        >
          <p>© {new Date().getFullYear()} VerifyOne Technologies Inc. All rights reserved.</p>
          <p className="max-w-xl">
            VerifyOne provides compliance controls and audit evidence. It does not provide legal
            advice and does not guarantee regulatory outcomes.
          </p>
        </div>
      </div>
    </footer>
  );
}
