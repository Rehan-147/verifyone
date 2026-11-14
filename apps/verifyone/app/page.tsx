import type { Metadata } from 'next';
import Hero from '../components/home/Hero';
import Problem from '../components/home/Problem';
import Solution from '../components/home/Solution';
import Checks from '../components/home/Checks';
import Decisions from '../components/home/Decisions';
import AuditEvidence from '../components/home/AuditEvidence';
import Developer from '../components/home/Developer';
import Platforms from '../components/home/Platforms';
import BuyerPaths from '../components/home/BuyerPaths';
import Proof from '../components/home/Proof';
import Pricing from '../components/Pricing';
import FAQ from '../components/home/FAQ';
import FinalCTA from '../components/home/FinalCTA';

export const metadata: Metadata = {
  description:
    'VerifyOne checks DNC, reassigned-number risk, consent, calling hours, and litigator risk before AI agents dial or send. Returns allow, review, or block with a tamper-evident audit record.',
  keywords: [
    'pre-dial compliance',
    'pre-action compliance gate',
    'AI voice agent',
    'AI calling compliance',
    'Vapi compliance',
    'Retell inbound screening',
    'TCPA compliance tool',
    'DNC check API',
    'reassigned number check',
    'litigator scrub',
    'phone gate API',
    'MCP server',
    'outbound calling compliance',
  ],
  alternates: { canonical: 'https://app.verifyone.io' },
  twitter: {
    card: 'summary_large_image',
    title: 'VerifyOne — Stop risky AI outbound actions before they happen',
    description: 'One API call before every AI dial or send returns an auditable compliance decision.',
  },
};

export default function Home() {
  return (
    <main>
      <Hero />
      <Problem />
      <Solution />
      <Checks />
      <Decisions />
      <AuditEvidence />
      <Developer />
      <Platforms />
      <BuyerPaths />
      <Proof />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </main>
  );
}
