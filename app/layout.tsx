import type { Metadata } from 'next';
import '../vendor/design-system/astryx-neutral-theme.css';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const SITE_URL = 'https://app.verifyone.io';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VerifyOne — Pre-Dial Compliance Gate for AI Agents',
    template: '%s | VerifyOne',
  },
  description:
    'VerifyOne checks DNC, reassigned-number risk, consent, calling hours, and litigator risk before AI agents dial or send. Returns allow, review, or block with a tamper-evident audit record.',
  keywords: [
    'pre-dial compliance',
    'pre-action compliance gate',
    'AI voice agent',
    'AI calling compliance',
    'Vapi compliance',
    'Retell pre-call gate',
    'TCPA compliance tool',
    'DNC check API',
    'reassigned number check',
    'litigator scrub',
    'phone gate API',
    'MCP server',
    'outbound calling compliance',
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'VerifyOne — Stop risky AI outbound actions before they happen',
    description: 'One API call before every AI dial or send returns an auditable compliance decision.',
    url: SITE_URL,
    siteName: 'VerifyOne',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VerifyOne — Stop risky AI outbound actions before they happen',
    description: 'One API call before every AI dial or send returns an auditable compliance decision.',
  },
};

const ORGANIZATION_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'VerifyOne',
  url: SITE_URL,
  description:
    'VerifyOne is the pre-action compliance gate for AI calling and messaging agents. One API call before every dial or send returns an auditable allow, review, or block decision — so your agent blocks risky contacts instead of creating liability.',
});

const WEBSITE_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'VerifyOne',
  url: SITE_URL,
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ORGANIZATION_JSONLD }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: WEBSITE_JSONLD }}
        />
        <Navbar />
        <div id="main" className="flex-1">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
