
# Prompt for Claude Code
You are Claude Code. This is VerifyOne - a 1Lookup clone for agencies.
Your tasks:
1. Take the prototype artifact HTML (in /reference/verifyone-app.html) and convert its UI into this Next.js structure. Keep design dark #0A0F1E, lime #A3E635.
2. Wire lib/upstream.ts to real Twilio, ZeroBounce, IPinfo APIs. Keep validators.ts return shape.
3. Implement Stripe checkout for $149/$449/$999 plans, credit ledger, Prisma DB.
4. Make all 20 /tools/[slug] pages fully functional with ToolChecker.tsx and SEO meta (title, description, FAQ schema).
5. Make all 8 /compare/[slug] pages with tables.
6. Test bulk CSV: upload -> validate -> download results CSV.
7. Deploy checklist: vercel deploy, set env, add sitemap.xml, robots.txt, Google Search Console.
Do not remove pricing or credit logic. Do not add auth beyond simple email + API key for MVP.
