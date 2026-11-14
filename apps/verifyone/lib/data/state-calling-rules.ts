/**
 * Stricter state solicitation windows reviewed against the cited statutes.
 * These statutes have scope/exemption details; counsel should confirm applicability
 * to each campaign and call type before relying on this table as legal advice.
 *
 * Candidates for counsel review before adding a general daily window: AK, AL, AR, AZ,
 * CA, CO, CT, DC, DE, GA, HI, IA, ID, IL, IN, KS, KY, LA, MA, MD, ME, MI, MN, MO,
 * MS, MT, NC, ND, NE, NH, NJ, NM, NV, NY, OH, OR, PA, RI, SC, SD, TN, TX, UT, VA,
 * VT, WI, WV, WY, and Canadian provinces/territories. Sunday/holiday restrictions
 * are not implemented. Texas has a separate Sunday restriction for automated
 * dial-announcing devices playing recorded messages (Tex. Util. Code § 55.125);
 * that call-type-specific rule needs counsel review.
 */
export const STATE_CALLING_RULES: Record<string, {
  start: string;
  end: string;
  citation: string;
  last_reviewed: string;
  needs_counsel_review: true;
}> = {
  FL: {
    start: '08:00',
    end: '20:00',
    citation: 'Fla. Stat. § 501.616(6)(a)',
    last_reviewed: '2026-11-14',
    needs_counsel_review: true,
  },
  OK: {
    start: '08:00',
    end: '20:00',
    citation: 'Okla. Stat. tit. 15, § 775C.4(A)(1)',
    last_reviewed: '2026-11-14',
    needs_counsel_review: true,
  },
  WA: {
    start: '08:00',
    end: '20:00',
    citation: 'Wash. Rev. Code § 80.36.390(8)',
    last_reviewed: '2026-11-14',
    needs_counsel_review: true,
  },
};
