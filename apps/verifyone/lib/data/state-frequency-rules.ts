/**
 * State limits on how often the same person may be called.
 *
 * Only rules verified against an official statute source are enforced here. Each rule is
 * applied per VerifyOne customer account across ALL of that customer's calls to the number
 * (we cannot tell "subject matter" apart, so we take the stricter reading).
 *
 * Candidates for counsel review (NOT enforced until verified from an official source):
 * - OK: Oklahoma Telephone Solicitation Act, 15 O.S. § 775C.4 — believed to contain a similar
 *   three-calls-per-24-hours limit; the official text could not be retrieved on 2026-11-27.
 * - MD: Maryland Stop the Spam Calls Act (Md. Code, Com. Law § 14-4501 et seq.) — unverified.
 * Customers can set a stricter account-wide cap themselves (Organization.callCap24h).
 */
export type StateFrequencyRule = {
  /** Maximum calls allowed in the window; the next one is blocked. */
  maxCalls: number;
  windowHours: number;
  citation: string;
  source_url: string;
  last_reviewed: string;
  needs_counsel_review: true;
};

export const STATE_FREQUENCY_RULES: Record<string, StateFrequencyRule> = {
  FL: {
    // "More than three commercial telephone solicitation phone calls from any number to a person
    // over a 24-hour period on the same subject matter or issue" are prohibited.
    maxCalls: 3,
    windowHours: 24,
    citation: 'Fla. Stat. § 501.616(6)(b)',
    source_url: 'https://www.flsenate.gov/Laws/Statutes/2025/501.616',
    last_reviewed: '2026-11-27',
    needs_counsel_review: true,
  },
};

/** Customer-set caps must stay within these bounds. */
export const ORG_CALL_CAP_MIN = 1;
export const ORG_CALL_CAP_MAX = 50;
export const FREQUENCY_WINDOW_HOURS = 24;
