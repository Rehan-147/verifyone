// Legal page content. These are plain-language templates drafted for the
// pre-launch site — they must be reviewed by counsel before public launch.
// Marked clearly on every page.

export type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  sections: { h: string; p: string[] }[];
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacy',
    title: 'Privacy policy',
    updated: 'Draft — pending legal review',
    intro:
      'This policy explains what VerifyOne collects when you use the pre-dial compliance gate, dashboard, and API, and how that data is handled. Template draft — to be reviewed by counsel before public launch.',
    sections: [
      {
        h: 'What we collect',
        p: [
          'Account data: the email address you sign up with, your plan, and hashed API keys (we store only a SHA-256 hash; keys are shown once at creation).',
          'Gate request data: the phone number or email you check, the channel, the consent fields you declare, and the checks you enable. Evidence records store numbers masked (last 4 digits only).',
          'Operational data: rate-limit counters, monthly quotas, billing events, and security logs.',
        ],
      },
      {
        h: 'What we do not do',
        p: [
          'We do not sell contact data. We do not build marketing profiles from your gate requests. We do not store full phone numbers in audit logs.',
        ],
      },
      {
        h: 'Upstream processors',
        p: [
          'When features you enable require them, checks are performed by upstream providers (for example Telnyx for carrier data, Reoon or ZeroBounce for email verification, IPinfo for IP intelligence). See the security page for the current subprocessor list.',
        ],
      },
      {
        h: 'Retention & deletion',
        p: [
          'Evidence records are retained per your customer-configured retention window and can be exported as CSV on paid plans. Account deletion removes account data; evidence retention after account closure follows your configured policy and applicable law.',
        ],
      },
      {
        h: 'Contact',
        p: ['Privacy questions and deletion requests: use the contact channel in your dashboard.'],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    updated: 'Draft — pending legal review',
    intro:
      'These terms govern your use of the VerifyOne API and dashboard. Template draft — to be reviewed by counsel before public launch.',
    sections: [
      {
        h: 'The service',
        p: [
          'VerifyOne provides pre-action compliance checks and tamper-evident evidence records for outbound communications. The service returns decisions and records; it does not place calls, send messages, or provide legal advice.',
        ],
      },
      {
        h: 'Your responsibilities',
        p: [
          'You are responsible for the lawfulness of your outbound campaigns, the accuracy of consent data you provide, your use of check results, and compliance with applicable law (including TCPA, FCC, and FTC requirements). You must respect every gate decision in your agent behavior.',
        ],
      },
      {
        h: 'Acceptable use',
        p: [
          'Do not use VerifyOne to facilitate unlawful outreach, to circumvent suppression lists, or to misrepresent compliance status. See the acceptable use policy.',
        ],
      },
      {
        h: 'Billing',
        p: [
          'Paid plans are billed through Dodo Payments (merchant of record). Credits roll over for 3 months. Cancel any time; see the pricing page for current terms.',
        ],
      },
      {
        h: 'No warranty of legal outcome',
        p: [
          'The service provides compliance controls and audit evidence. It does not guarantee any regulatory or legal outcome, and decisions do not constitute legal advice.',
        ],
      },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable use policy',
    updated: 'Draft — pending legal review',
    intro:
      'Rules for what VerifyOne may and may not be used for. Template draft — to be reviewed by counsel before public launch.',
    sections: [
      {
        h: 'Allowed',
        p: [
          'Gating your own or your clients\' outbound calls and messages against suppression, DNC, reassigned-number, litigator, consent, and calling-hours checks; storing and exporting the resulting evidence; integrating the gate into dialers and AI agent platforms.',
        ],
      },
      {
        h: 'Not allowed',
        p: [
          'Using VerifyOne to facilitate calls or messages to numbers the gate has blocked or flagged for review without human approval.',
          'Falsifying consent fields, stripping or ignoring gate decisions, or using the service to claim compliance your process does not have.',
          'Unlawful, fraudulent, or harassing outreach of any kind; resale of registry data; attempts to identify or de-anonymize individuals from masked evidence.',
          'Load testing, scraping, or reverse-engineering the service or its data sources.',
        ],
      },
      {
        h: 'Enforcement',
        p: [
          'Violations may result in rate limiting, suspension, or termination. Evidence records of blocked actions remain available for your audit purposes.',
        ],
      },
    ],
  },
  {
    slug: 'compliance-disclaimer',
    title: 'Compliance disclaimer',
    updated: 'Current',
    intro:
      'VerifyOne provides compliance controls and audit evidence. It does not provide legal advice and does not guarantee regulatory outcomes.',
    sections: [
      {
        h: 'What VerifyOne is',
        p: [
          'A pre-action decision layer: before an AI agent dials or sends, VerifyOne checks the contact and campaign context against your enabled checks and returns an auditable decision with a reason and evidence ID.',
        ],
      },
      {
        h: 'What VerifyOne is not',
        p: [
          'Not legal advice. Not a law firm. Not a guarantee that a call, campaign, or program complies with TCPA, FCC, FTC, state, or any other law.',
          'An ALLOW decision means the enabled checks passed at check time. It is not a certification of lawfulness, and it does not substitute for valid consent records or lawful campaign practices.',
          'A DENY decision reflects a check result or unavailability — it should be treated as a signal not to act, not as a complete legal analysis.',
        ],
      },
      {
        h: 'Data coverage',
        p: [
          'Check coverage depends on authorized registry access and loaded data files (for example the FTC DNC file, litigator feeds, FCC RNDB). Absent or unavailable data is never silently treated as a pass; it results in review or block per the fail-safe policy.',
        ],
      },
      {
        h: 'Your responsibility',
        p: [
          'You remain responsible for your consent records, campaign practices, agent behavior, and compliance with applicable law. Consult qualified counsel for legal advice.',
        ],
      },
    ],
  },
  {
    slug: 'data-processing',
    title: 'Data processing',
    updated: 'Draft — pending legal review',
    intro:
      'How request data flows through VerifyOne and its subprocessors. Template draft — to be reviewed by counsel (and expanded into a DPA where applicable) before public launch.',
    sections: [
      {
        h: 'Flow of a gate request',
        p: [
          '1. Your agent sends the contact and campaign context to the VerifyOne API.',
          '2. Enabled checks run: locally cached registry files first (FTC DNC, litigator feed), then optional live upstreams (Telnyx HLR, email verifiers).',
          '3. The decision, reason, and evidence ID are returned to you and written to the hash-chained evidence log with the number masked.',
        ],
      },
      {
        h: 'Processors by function',
        p: [
          'Carrier / HLR: Telnyx (optional profile). Email verification: Reoon or ZeroBounce (optional). IP intelligence: IPinfo (optional). Billing: Dodo Payments. Persistence: Supabase Postgres (optional). Hosting: Vercel.',
          'Registry files (FTC DNC, litigator feeds, FCC RNDB) are processed in our own infrastructure from loaded data files.',
        ],
      },
      {
        h: 'Sub-processors & international transfer',
        p: [
          'Providers are U.S.-hosted today. An updated subprocessor list is maintained on the security page. Cross-border transfer terms will be finalized in the DPA.',
        ],
      },
      {
        h: 'Security measures',
        p: [
          'SHA-256 hashed API keys, masked evidence storage, hash-chained tamper-evident records, per-key rate limits and quotas. See the security page for details.',
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
