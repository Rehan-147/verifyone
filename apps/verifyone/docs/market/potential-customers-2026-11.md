# VerifyOne — potential customers

Prepared 2026-11-06. Product as it exists in this repo: one pre-dial gate call per outbound
attempt (`POST /api/v1/gate/phone`), returning ALLOW / DENY with reason + evidence ID; checks
internal suppression, FTC National DNC, FCC Reassigned Numbers Database, carrier status,
known-litigator risk, calling hours, consent status/timestamp. US mobile first. Published prices:
Starter **$149/mo (30,000 credits)**, Growth **$449/mo (120,000)**, Pro **$999/mo (400,000)**,
free tier 500 checks/mo, billing via Dodo Payments.

Every company named below is a **prospect**, not a customer. Sources are inline; anything I could
not verify is marked *not found* rather than estimated.

---

## 1. Three findings that change who you can sell to

**Real-time per-call checking is not legally required.** The DNC safe harbor is explicitly batch:
47 CFR 64.123(c)(2) / 64.1200(c)(2)(i)(D) accept a registry version **no more than 31 days old**
plus written protocols and records ([FTC Q&A](https://www.ftc.gov/business-guidance/resources/qa-telemarketers-sellers-about-dnc-provisions-tsr-0)).
RND querying is **voluntary** — it only buys the safe harbor at 47 CFR 64.1200(m)
([Shipkevich 2026-10-22](https://www.shipkevich.com/reassigned-numbers-database-tcpa-safe-harbor/)).
So "you are legally required to gate every dial" is false, and any compliance officer's counsel will
say so in the first call. What survives diligence: a 31-day-old list cannot protect a call you place
on day 12; the **one-call safe harbor was vacated in *ACA Int'l v. FCC* (D.C. Cir., 2018-03-16)**, so
there is no longer a free first dial to a reassigned number
([Justia](https://law.justia.com/cases/federal/appellate-courts/cadc/15-1211/15-1211-2018-03-16.html),
[dnc.com FAQ](https://www.dnc.com/faq/there-reassigned-number-safe-harbor)); and defense is won with
records, which is what the evidence ID is for.

**The consent-rule urgency you may have been sold is gone.** The FCC's one-to-one consent rule was
vacated by the 11th Circuit on **2025-01-24** (*Insurance Marketing Coalition v. FCC*,
[Kelley Drye](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/eleventh-circuit-vacates-tcpa-11-consent-rule))
and the FCC formally deleted it effective **2025-08-29** (90 FR 42137,
[FCC](https://www.fcc.gov/document/fcc-removes-one-one-consent-rule-nullified-court-decision)).
Live drivers instead: revocation honored within 10 business days since 2025-04-11
([Nixon Peabody](https://www.nixonpeabody.com/insights/alerts/2025-04-11/fcc-partially-delays-new-tcpa-consent-revocation-rules)),
FCC 26-67 category-specific revocation (adopted 2026-09-30,
[Crowell](https://www.crowell.com/en/insights/client-alerts/fcc-officially-adopts-amendments-to-tcpa-rules)),
and AI voices already being covered since Declaratory Ruling FCC 24-17 (2024-02-08).

**Someone already built the spec.** PossibleNOW **DNcall** does real-time per-call checks across
federal/state/internal/wireless/RND/litigator **plus calling hours, consent and audit evidence**
([product page](https://www.possiblenow.com/products/dncsolution/do-not-call)) — near-identical to
VerifyOne, sold to SMB telemarketers. Bland AI ships **pre-call real-time suppression checks**
([blog 2026-08-09](https://www.bland.ai/blog/tcpa-violation-fines)); Twilio Lookup returns
`reassigned_number` ([2026-04-08](https://www.twilio.com/en-us/blog/lookup-reassigned-number-tcpa-compliance));
GoHighLevel enforces 8am–8pm windows and daily caps but does **no list checking**
([help doc 2026-09-13](https://help.gohighlevel.com/support/solutions/articles/155155000006679)).
Your differentiation is the API/MCP decision surface, campaign context, and tamper-evident ID.
For Vapi/Retell outbound, the customer-controlled scheduler must call VerifyOne first and
create the platform call only on `ALLOW`; inbound screening is beta, rejects invalid numbers,
flags loaded litigator matches, has no per-account block-list lookup yet, and skips outbound
DNC/consent rules. Verify current
pricing in `lib/plans.ts` rather than using older market notes.

---

## 2. Tier 0 — voice-AI platforms (embed / white-label; highest ceiling, slowest)

These are the "guidance-rich, feature-poor" platforms: they publish TCPA content but ship no gate.
One deal here puts the gate in front of thousands of downstream builders.

| Prospect | Why | Evidence |
|---|---|---|
| **Vapi** | Outbound call creation dials directly; there is no customer pre-dial webhook. A separate scheduler can call the VerifyOne REST gate before creating the Vapi call. | no native outbound gate; inbound beta rejects invalid numbers, flags loaded litigators, and skips outbound DNC/consent rules; no account block-list lookup |
| **Retell AI** | Outbound call creation dials directly; there is no customer pre-dial webhook. A separate scheduler can call the VerifyOne REST gate before creating the Retell call. | no native outbound gate; inbound beta rejects invalid numbers, flags loaded litigators, and skips outbound DNC/consent rules; no account block-list lookup |
| **Synthflow** | no-code voice agents, outbound; only an AI Transparency Statement (GDPR-flavoured), no TCPA product ([docs](https://docs.synthflow.ai/ai-transparency)) | none |
| **Cognigy** | REST outbound calls via voice gateway; SOC2/HIPAA only ([docs](https://docs.cognigy.com/voice-gateway/creating-outbound-calls)) | none |
| **Kore.ai** | enterprise voice AI, no DNC product | [platform roundup 2026-08-05](https://www.11x.ai/guides/ai-voice-agents-outbound-calling) |
| **ElevenLabs (Agents)** | outbound calling strategy content, no gate ([2025-03-20](https://elevenlabs.io/blog/outbound-ai-calling-strategy-guide-for-2025)) | guidance only |
| **LiveKit / Pipecat (Daily)** | OSS agent frameworks — devs dial with no compliance layer at all; natural MCP fit ([Series B](https://livekit.com/blog/livekits-series-b)) | none |
| **Telnyx / Bandwidth** | carrier-grade Voice AI + dialer templates; attestation ≠ DNC gate ([Telnyx](https://telnyx.com/products/voice-ai-agents), [Bandwidth 2026-06-23](https://investors.bandwidth.com/news-releases/news-release-details/bandwidth-launches-build-giving-ai-agents-autonomous-access)) | partial/adjacent |
| **Voiceflow** | needs external telephony; buyers are builders | [roundup](https://www.11x.ai/guides/ai-voice-agents-outbound-calling) |

Already covered — do **not** treat as prospects: **Bland** (pre-call DNC), **Twilio** (Lookup RND),
**Fini** (built-in TCPA/DNC), **Regal** (built-in scrubbing), **Gryphon** (full pre-dial engine),
**GoHighLevel** (hours only, so its *agencies* are prospects but the platform is not).
PolyAI / Five9 / Genesys / NICE / Verint have mature dialer compliance — lowest fit.

Realistic: 1–2 of these land, in 6–9 months, as rev-share/white-label, not as a $149 subscription.

## 3. Tier 1 — outbound AI-app companies and agencies (first revenue)

They run the campaigns, they get sued, they have no gate.

**Named vendors — corrected after checking each site on 2026-11-06:** real outbound targets are
**11x** (a page literally called "Consented Outbound Calling"), **Avoca** (`/outbound`, SMS + calls),
**Numa** (Opportunity Agent re-dials 1,500+ dealerships' prior customers) and **Regie.ai** (Parallel
Dialer, up to five lines at once — the highest-exposure pattern found). **Podium** is a watch-list:
their own homepage frames the AI Employee as inbound, so outbound is not yet pitchable.
**Dropped as non-buyers — inbound-only or no voice at all:** Goodcall, Rosie (heyrosie.com, $49/mo
entry), Slang.ai, Kickcall (inbound healthcare receptionist; advertises HIPAA/SOC 2/PIPEDA but no
TCPA layer) and Conversica (email/SMS/chat only). Five of the twelve names in the first draft of this
document were wrong; the outreach CSV carries the corrections.

**The long tail that is bigger than all of them:** GoHighLevel and Vapi/Retell **agencies** running
outbound AI campaigns for local businesses. HighLevel ships outbound AI call agents with native
compliance checks — daily call limits, per-number caps and 8AM–8PM windows — but its own help doc
does **not** cover DNC or reassigned numbers. That gap is the cleanest wedge in this research.
Count of US agencies doing outbound AI voice: *not found*.

## 4. Tier 2 — regulated operators who own the liability

| Segment | Size (sourced) | Angle |
|---|---|---|
| Debt collection agencies | **5,494 businesses / $15.9B** (IBISWorld 2026) vs **~2,500 / $15.1B** (CFPB 2025-08-08) — definitional gap, report both ([IBISWorld](https://www.ibisworld.com/united-states/industry/telemarketing-call-centers/1468/), [regulations.gov](https://www.regulations.gov/document/CFPB-2025-0030-0001)) | reassigned numbers + revocation + per-call evidence; enterprise already bought (Gryphon/Intrix/ROL) → target the 1–50-seat tail |
| Personal-injury / mass-tort intake | Firms doing AI phone intake: *not found*. Adjacent vendors Smith.ai, Law Ruler verified | the scare that works: **Wilshire** settled **up to $5,975,000** (Fla. Cir. Ct. 2025-022621-CA-01, ~$75/claim, class 2020–2026) over prerecorded/AI-voice calls ([Henson Legal 2026-08-15](https://www.henson-legal.com/newsroom/ai-voice-tcpa-class-action-law-firms-wilshire-dv-injury), [ClassAction.org 2026-03-25](https://www.classaction.org/news/up-to-5.975m-wilshire-law-firm-settlement-ends-class-action-over-allegedly-unlawful-prerecorded-calls)); a separate class action targets three law firms using AI voices for mass-tort clients ([Sheppard 2026-07-22](https://www.sheppard.com/insights/blogs/ai-robocalls-tcpa-and-texas-converge-in-class-action)) |
| Telemarketing & call centres | **45,374 US businesses** (IBISWorld 2026) | the incumbent batch-scrub buyers; hard to displace PossibleNOW/dnc.com |
| Healthcare reminders / no-show | Dental offices **180,742** (IBISWorld 2026) vs ADA ~135k establishments — conflict; physician offices *not found* | HIPAA-safe evidence + hours; needs BAA, which you do not have yet |
| Political / advocacy | **8,816 federal PACs** filed 2025-01-01→2026-03-31 (FEC 2026-10-01); campaigns running phone-banking: *not found*. Club For Growth asked the FCC for a waiver to allow AI political robocalls ([Reuters 2026-10-07](https://www.reuters.com/world/us-agency-considers-allowing-new-ai-political-robocalls-before-election-2026-10-07/)) | **wait** until the waiver resolves; political calls have a different rule set |

Damages context for all of the above: **$500 per call, up to $1,500 willful**, private right of
action, 4-year SOL, **no aggregate statutory cap** (a due-process ceiling exists — 9th Cir. remanded
a $925.2M award, *ViSalus*). TCPA filings **+63% in 2025**; 1,907 cases YTD through Aug 2026
([LexisNexis 2026-10-26](https://www.lexisnexis.com/community/amp-insights/82/consumer-protection-litigation-trends),
[Receivables Info 2026-09-29](https://receivablesinfo.com/2026-09-29/webrecon-august-2026-litigation-stats/)).
State law adds real exposure: FTSA §501.059 ($500, trebled) and Oklahoma's TSAct of 2022.
Correction to a number circulating in vendor blogs: the "$4.75M–$19M AI-voice settlement range" is
**not** an AI-voice tier — Hy Cite $4.75M is a robocall case, and $19M (*Mantha v. QuoteWizard*) is a
2019 SMS case. Do not use that range in front of counsel.

## 5. Tier 3 — channels, not customers

ActiveProspect **LeadConduit** (Blacklist Alliance sells $0.01/scrub through it), **Salesloft
marketplace** (Gryphon is listed there), MCP registries/directories, dialer ISVs, TCPA defence law
firms and consultancies as referrers, and identity/attestation players (Hiya, First Orion,
TransNexus) as co-marketing rather than buyers.

## 6. Not customers

Enterprise contact centres already covered by Genesys/Five9/NICE/Verint dialer compliance; banks,
telcos and MVNOs with in-house scrubbing; the incumbents themselves (Contact Center Compliance,
PossibleNOW, Blacklist Alliance, TCPA Litigator List, NumberBroom); inbound-only answering services;
EU-only callers (GDPR/PECR, not TCPA); SMS-only lead-gen (different rule set).

---

## 7. The arithmetic that decides the order

$100k MRR at your published prices, with a plausible blend (300 Starter + 90 Growth + 15 Pro) =
**405 paying customers and 25.8M gate checks/month** (~10M/day).

Unit economics warning, and it is the real constraint: blended revenue there is **$0.0039 per
check**, while raw FCC RND Tier-1 costs **$0.008 per query** (2025-04-28 repricing: $8/mo per 1,000
queries, down to **$28,000/mo per 50M ≈ $0.00056/query** at the top tier
— [enzodialer](https://enzodialer.com/resources/compliance/reassigned-numbers-database),
[FCC 2025-04-07](https://www.fcc.gov/document/fcc-announces-reduced-pricing-reassigned-numbers-database)).
Value-added per-scrub APIs clear at ~$0.01 (Blacklist Alliance) and $0.002/query at
TCPA Litigator List ($199/mo per ~100k scrubs). If every check hit RND uncached you would pay more
in data than you charge. The model only works with caching + querying RND only when the consent date
is old enough to matter, and with RND volume tiers that need roughly 10M+ queries/month — i.e. the
platform deals in Tier 0 are what make the $999 plan profitable, not what make it possible to sell.

Median realistic path for a solo founder, not the blend above: **1 platform/embed agreement +
25–40 outbound-AI or collection accounts ≈ 40–80 paying customers**, mostly Growth tier, with the
agency long tail as the volume source.

**Sell in this order:** (1) Tier 1 outbound-AI vendors and their agencies — 30–60 day cycle,
self-serve $149 entry, the Wilshire settlement is the opener; (2) the debt-collection tail —
highest ACV, needs FDCPA/state-license language; (3) Tier 0 platform embeds — start the conversations
now and expect 6–9 months, because that is the only route to 25M+ checks/month. Skip political until
the FCC waiver resolves and skip enterprise contact centres entirely.

---

## 8. Reachability — checked company by company, 2026-11-06

The plan above assumed cold email. The sites say otherwise, so this section overrides parts of it.

**No voice-AI platform publishes a partnerships email.** Across Vapi, Retell, Synthflow, Cognigy,
Kore.ai, ElevenLabs, LiveKit, Telnyx, Bandwidth and Voiceflow, every published address is
`support@`, `privacy@`, `contact@` or `enterprise@` — CS and legal inboxes. The real doors are
application forms: [Vapi partner directory](https://vapi.ai/partnerships/directory) (Airtable form),
[Retell app-partner](https://www.retellai.com/app-partner), [Synthflow partners](https://synthflow.ai/partners),
[Kore.ai ISV](https://info.kore.ai/partner-isv), [Cognigy → NICE partner program](https://www.cognigy.com/partner)
(tiers SI/VAR/**Marketplace**/BPO/Referral), [Telnyx partners](https://telnyx.com/partners),
[ElevenLabs two forms](https://elevenlabs.io/contact-partnerships). Only one named person surfaced
publicly: Jordan Dearsley, Founder & CEO of Vapi. **Voiceflow's `/partners` returns 410 Gone** and
LiveKit has no directory at all, so neither is a partnership play.

**Best single door: ElevenLabs.** Their agents directory advertises 400+ integrations including a
Contact Center & Telephony category (Genesys, Five9, NiCE, Twilio, Telnyx, Vonage, Plivo) with **zero
compliance vendors** — you would be first in the category. **Name-drop proof:** Vapi's directory
already lists **didlogic** (number intelligence) and no DNC/compliance vendor; the same is true of
Retell's integration list. That proves the tile exists and warns that an adjacent data vendor is
already placed on two of your targets.

**Channels that are genuinely open today:** [LeadConduit add-on services](https://activeprospect.com/leadconduit-overview/add-on-services/)
already carries four-plus scrub/compliance vendors (Anura, Blacklist Alliance, BriteVerify, CCC,
Fenris, Telesign, Trestle, Webbula, Experian) — Blacklist's Litigation Firewall is priced **$0.01 per
scrub**, which is the price ceiling for this route. [Salesloft Marketplace](https://marketplace.salesloft.com/partners/gryphon-ai)
publishes `partners@salesloft.com` and already lists Gryphon under Outbound Compliance. The
[Official MCP Registry](https://registry.modelcontextprotocol.io/) is free via `mcp-publisher` after
DNS namespace verification; [mcp.so](https://mcp.so/submit) is a **$39 one-time fee with no review**;
[Glama](https://glama.ai/mcp/servers) has an open submission form. **Closed/dead:** PulseMCP paused
submissions, Smithery's MCP proxy shut down 31 October, and the Free Caller Registry (First Orion)
explicitly excludes third parties registering numbers for other businesses — `trustyourcaller.com`
does not resolve at all. Twilio Voice Integrity is a Trust Hub feature for a customer's own numbers,
not a vendor channel.

**Two-way partner worth more than any listing:** Blacklist Alliance is **now part of Sonera**
(`info@blacklistalliance.com`, `/partners` and `/pricing` 404). They own per-scrub distribution to
contact centres and VoIP resellers; you own the agent-native decision layer they don't. Consuming
their litigator data also attacks the COGS problem in section 7. [TCPA Litigator List](https://tcpalitigatorlist.com/)
($199–$2,499/mo, API, `support@`) is the same idea at smaller scale.

**Named-buyer lists: what actually yields names.** [California DFPI debt collectors via NMLS Consumer
Access](https://dfpi.ca.gov/regulated-industries/debt-collection-licensee/) and Florida FDACS
telemarketing licences are free public searches with named licensees (no bulk download).
[MTTLA's Mass Tort Top 25](https://mttla.org/) is a short public list of exactly the firms with
mass-tort dialing budgets. The [FCC Robocall Mitigation Database](https://www.fcc.gov/robocall-mitigation-database)
names providers who already filed mitigation plans — companies with compliance staff. **Not usable:**
AAJ's directory is login-gated (a broker's "15,589 members" is not AAJ-published), and ACA
International publishes no member count while third parties claim ~5,500 against ACA's own ~1,800 —
use neither number. For legal-intake distribution, [Smith.ai](https://smith.ai/partners) runs open
reseller/referral/wholesale programs and [Law Ruler](https://www.lawruler.com/partners/become-a-partner/)
has a formal partner program; those two are the fastest route to PI firms without a sales force.

**Revised order given reachability:** (1) the four emailable Tier-1 vendors (Regie.ai `hello@`, Avoca
`hello@`, Numa `support@`, 11x demo form) — this week; (2) MCP Registry + mcp.so + Glama listings —
this week, near-zero cost; (3) Salesloft + LeadConduit + HighLevel marketplace applications — needs a
working connector and a Loom demo, so budget weeks of engineering, not weeks of selling; (4) Smith.ai /
Law Ruler reseller conversations for the PI segment; (5) the eight platform partner applications in
parallel, expecting one or two answers.
