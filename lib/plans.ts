// Plan tiers — single source for UI + Dodo checkout + webhooks.
// Internal keys (STARTER|GROWTH|PRO) map to DODO_PRODUCT_* env vars.
//
// ⚠ PRE-LAUNCH (see DEPLOY.md checklist): the Dodo dashboard products must be
// updated to match these prices/credits BEFORE live checkout is enabled.
// The charge amount is set by the Dodo product, not by this file — updating
// this file changes display + metadata + granted credits only.
// normalizePlanKey keeps legacy aliases (AGENT/AGENCY/COMPLIANCE_PRO) working.

export const PLANS = {
  STARTER: {
    key: 'STARTER' as const,
    name: 'Starter',
    tagline: 'Pre-Dial Gate',
    priceUsd: 299,
    credits: 30_000,
    shieldChecksMonthly: 30_000,
    blurb: 'For teams validating AI outbound campaigns.',
    features: [
      'Phone gate with core checks',
      'Full API access',
      'Bulk CSV screening',
      'Evidence records (audit trail)',
    ],
  },
  GROWTH: {
    key: 'GROWTH' as const,
    name: 'Growth',
    tagline: 'Pre-Dial Gate',
    priceUsd: 899,
    credits: 120_000,
    shieldChecksMonthly: 120_000,
    blurb: 'For agencies and teams running recurring outbound campaigns.',
    features: [
      'Higher volume',
      'DNC scrubbing',
      'HLR lookups',
      'Priority support',
      'Automation integrations (n8n / Make / Zapier via API)',
    ],
  },
  PRO: {
    key: 'PRO' as const,
    name: 'Pro',
    tagline: 'Pre-Dial Gate + Platform',
    priceUsd: 2399,
    credits: 400_000,
    shieldChecksMonthly: 400_000,
    blurb: 'For AI platforms, BPOs, and compliance-sensitive teams.',
    features: [
      'MCP AI-agent endpoint',
      'HubSpot integration (native webhook — rolling out)',
      'Dedicated SLA',
      'Custom credits',
    ],
  },
} as const;

export type PlanName = keyof typeof PLANS;

export const PLAN_ORDER: PlanName[] = ['STARTER', 'GROWTH', 'PRO'];

export function normalizePlanKey(input: string): PlanName | null {
  const u = String(input || '').toUpperCase().replace(/-/g, '_');
  const aliases: Record<string, PlanName> = {
    STARTER: 'STARTER',
    AGENT: 'STARTER',
    GROWTH: 'GROWTH',
    AGENCY: 'GROWTH',
    PRO: 'PRO',
    COMPLIANCE_PRO: 'PRO',
    COMPLIANCE: 'PRO',
  };
  const key = aliases[u];
  return key && key in PLANS ? key : null;
}
