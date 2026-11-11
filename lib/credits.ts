export const CREDIT_COSTS = { phone: 1, email: 1, ip: 1, spam: 1, hlr: 5, mnp: 3, dnc: 10, reverse: 10, skip: 10, company: 75, b2b: 75 };

/** Metered add-ons: premium vendor fees that must pass through, not absorb into a plan. */
export const ADDON_CREDITS = {
  /** TrustedForm certificate verification (per-cert vendor fee) */
  trustedform_verify: 1,
} as const;

/** One metered transaction = phone validation + DNC + litigator (AI Outbound Shield). */
export const GATE_BUNDLES = {
  ai_outbound_shield: {
    credits: 1,
    label: 'AI Outbound Shield Suite',
    includes: ['phone_validation', 'dnc_check', 'litigator_check', 'calling_hours', 'consent_rules'] as const,
    default_live_hlr: false,
  },
  full_stack: {
    // 5 credits (was 3): full_stack COGS (Telnyx live lookup + FCC RNDB ~$0.008/query)
    // exceeds the 3-credit revenue at every plan tier; CREDIT_COSTS.hlr already priced
    // live HLR at 5. Keeps the full_stack margin in the same band as the shield.
    credits: 5,
    label: 'Shield + Live HLR + RNDB',
    includes: ['phone_validation', 'dnc_check', 'litigator_check', 'live_hlr_carrier', 'reassigned_rndb'] as const,
    default_live_hlr: true,
  },
} as const;

export type GateProfile = keyof typeof GATE_BUNDLES;

export function gateBundleCredits(profile?: string, opts?: { trustedform?: boolean }): number {
  const p = (profile || 'ai_outbound_shield') as GateProfile;
  const base = GATE_BUNDLES[p]?.credits ?? GATE_BUNDLES.ai_outbound_shield.credits;
  return base + (opts?.trustedform ? ADDON_CREDITS.trustedform_verify : 0);
}

export function resolveGateProfile(body: { profile?: string; live_hlr?: boolean }): GateProfile {
  if (body.profile === 'full_stack' || body.live_hlr === true) return 'full_stack';
  return 'ai_outbound_shield';
}

export function costFor(type: string) {
  return (CREDIT_COSTS as Record<string, number>)[type] ?? 1;
}
export function deductCredits(userCredits: number, cost: number) {
  return Math.max(0, userCredits - cost);
}
