# VerifyOne Integrations + Supabase - Setup for Claude Code

## Supabase Setup (5 min)
1. Create project at supabase.com
2. SQL Editor -> paste supabase/migrations/001_init.sql
3. Copy env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

## Integrations Included
- Generic route: app/api/integrations/[provider]/route.ts -> POST /api/integrations/{slug}, forwards into the gate (README-100.md)
- Zapier: lib/integrations/zapier-make-n8n.ts -> zapier push (note: these definitions still call the raw /api/v1/validate_phone validator, not the gate)
- Make: same file -> Import JSON in Make
- n8n: same file -> Import workflow JSON
- HubSpot: app/api/webhooks/hubspot/route.ts -> signature-verified contact webhook; gates the phone read from the CRM API and PATCHes the verdict back via lib/integrations/hubspot.ts (needs HUBSPOT_TOKEN + HUBSPOT_APP_SECRET, not metered)
- HubSpot (generic): POST /api/integrations/hubspot gates and returns the verdict, writes nothing back
- Google Sheets: lib/integrations/google-sheets.js -> Apps Script =VERIFYONE() formula; set VERIFYONE_URL + VERIFYONE_KEY in Script Properties
- Instantly: app/api/bulk/route.ts -> call before campaign
- MCP: app/api/mcp/route.ts -> URL https://app.verifyone.io/api/mcp for Claude/Cursor
- Webhooks: app/api/webhooks/route.ts -> validation.completed

## What Claude Code has to do
- Wire lib/credits.ts to Supabase users table
- Add rate limiting: 200 req/10s per key, 1000/min per account (Upstash Redis)
- Dodo Payments is the merchant of record: POST /api/webhooks/dodo grants plan + credits (see docs/DEPLOY.md for DODO_* keys). No Stripe is wired and none should be added
- Deploy to Vercel

## File list
All files ready to copy into existing verifyone/ Next.js project from previous zip.
