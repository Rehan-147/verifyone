# VerifyOne - 1Lookup Clone for Agencies
End-to-end SaaS: Phone / Email / IP validation, 1Lookup model.
Target: Cold email & lead-gen agencies. $149 Starter / $449 Growth / $999 Pro.
Credits: 1 credit core, 5 HLR, 10 DNC. Rollover 3 months.

## For Claude Code - Start Here
1. npm install
2. cp .env.example .env - fill STRIPE_SECRET_KEY, TWILIO_*, ZEROBOUNCE_KEY, IPINFO_TOKEN, DATABASE_URL
3. npx prisma db push
4. npm run dev

## Structure
- app/page.tsx - Landing + Hero validator
- app/dashboard/page.tsx - Dashboard, credits, CSV bulk, API keys, billing
- app/tools/[slug]/page.tsx - 20 SEO free tool pages (dynamic)
- app/compare/[slug]/page.tsx - 8 compare pages
- app/guides/[slug]/page.tsx - 4 guides
- lib/validators.ts - All validation logic (phone/email/ip)
- lib/upstream.ts - Twilio / ZeroBounce / IPinfo adapters - TODO: plug real keys
- lib/credits.ts - Credit deduction
- lib/data/tools.ts - 20 tools + SEO metadata
- lib/data/compare.ts - Compare data
- components/* - UI components

## SEO Strategy Copied from 1Lookup
- 20 free tools: /tools/free-carrier-lookup, /tools/free-hlr-lookup, etc. Each page has H1, FAQ, How it works, table, CTA to /dashboard.
- 8 compare: /compare/twilio, /compare/abstract-api etc.
- Free tools are entry funnel: Free -> Trial (1000 credits) -> Paid.
- Internal linking: footer sitemap links all tools.

## API
POST /api/v1/validate_phone {phone}
POST /api/v1/verify_email {email}
POST /api/v1/ip_lookup {ip}
Header: Authorization: Bearer vk_live_xxx
Response: {valid, riskScore, carrier, lineType, ...} - see lib/types.ts

## Credits
See prisma/schema.prisma - User, ApiKey, CreditLedger, CheckHistory
