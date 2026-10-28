# VerifyOne Integrations + Supabase - Setup for Claude Code

## Supabase Setup (5 min)
1. Create project at supabase.com
2. SQL Editor -> paste supabase/migrations/001_init.sql
3. Copy env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

## Integrations Included
- Zapier: lib/integrations/zapier-make-n8n.ts -> zapier push
- Make: same file -> Import JSON in Make
- n8n: same file -> Import workflow JSON
- HubSpot: lib/integrations/hubspot.ts -> webhook to /api/integrations/hubspot
- Google Sheets: lib/integrations/google-sheets.js -> Apps Script
- Instantly: app/api/bulk/route.ts -> call before campaign
- MCP: app/api/mcp/route.ts -> URL https://app.verifyone.io/api/mcp for Claude/Cursor
- Webhooks: app/api/webhooks/route.ts -> validation.completed

## What Claude Code has to do
- Wire lib/credits.ts to Supabase users table
- Add rate limiting: 200 req/10s per key, 1000/min per account (Upstash Redis)
- Add Stripe webhook to update users.plan and credits
- Deploy to Vercel

## File list
All files ready to copy into existing verifyone/ Next.js project from previous zip.
