# 🚀 Deploy VerifyOne — step by step (30 minutes)

## 1. Push to GitHub

```bash
cd verifyone-FINAL-ALL
git add -A && git commit -m "VerifyOne: gate + payments + integrations"
git remote add origin https://github.com/YOU/verifyone.git
git push -u origin main
```

## 2. Import to Vercel

1. vercel.com → **Add New → Project** → import the repo
2. Set Root Directory to apps/verifyone (the app workspace)
3. Framework preset: **Next.js** (auto-detected) → Deploy (it will build with mocks — fine)
4. Note your URL: `https://verifyone.vercel.app`

## 3. Environment variables (Vercel → Settings → Environment Variables)

Copy from your local `.env` — set for **Production + Preview**:

| Key | Value | Required for |
|---|---|---|
| `APP_URL` | `https://yourdomain.com` (or vercel URL) | webhooks, sitemap, MCP docs |
| `TELNYX_API_KEY` | from portal.telnyx.com | real phone/line-type/disconnected |
| `REOON_API_KEY` | from reoon.com | real email verification |
| `IPINFO_TOKEN` | from ipinfo.io | real IP lookup |
| `DODO_PAYMENTS_API_KEY` | app.dodopayments.com | payments |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` first → `live_mode` later | payments |
| `DODO_PAYMENTS_WEBHOOK_KEY` | `whsec_...` from Dodo webhook settings | webhook security |
| `DODO_PRODUCT_STARTER` / `_GROWTH` / `_PRO` | `prod_...` ids | plan mapping |
| `DATABASE_URL` | Supabase Postgres connection string | production data (optional at first) |

Redeploy after adding env vars.

## 4. Wire the Dodo webhook

1. Dodo dashboard → **Webhooks → Add endpoint**
2. URL: `https://yourdomain.com/api/webhooks/dodo`
3. Events: `payment.succeeded`, `subscription.active`, `subscription.renewed`, `subscription.cancelled`, `subscription.expired`
4. Copy the webhook signing key (`whsec_...`) → set as `DODO_PAYMENTS_WEBHOOK_KEY` → redeploy
5. Use Dodo's "Send test event" — you should see `{"received": true, ...}`

## 5. Post-deploy checklist

- [ ] `https://yourdomain.com/` loads (light theme)
- [ ] `POST /api/auth/signup` returns a `vk_live_...` key
- [ ] Gate returns `source: "telnyx"` (not mock) on a real number
- [ ] Pricing button → Dodo test checkout completes → credits granted (check `/api/billing/me`)
- [ ] `https://yourdomain.com/sitemap.xml` + `/robots.txt` + `/llms.txt` load
- [ ] Google Search Console: add property → submit `https://yourdomain.com/sitemap.xml`

## 6. Go live checklist (before charging real money)

- [ ] Dodo → switch `DODO_PAYMENTS_ENVIRONMENT=live_mode`, real product IDs
- [ ] Dodo business verification completed (payouts enabled)
- [ ] Swap `.data` JSON stores → Postgres (`npx prisma db push`) — needed before scale
- [ ] Set a strong `DODO_PAYMENTS_WEBHOOK_KEY` (the default test one in `.env` must be gone)
- [ ] Legal pages: privacy policy + terms (Dodo's MoR covers tax, not your ToS)

## ⚠️ 6b. Dodo price sync — REQUIRED before real checkout (do not skip)

`lib/plans.ts` now displays: **Starter $299/30,000 cr · Growth $899/120,000 cr · Pro $2,399/400,000 cr**.
Meters: shield = 1 credit/check · full_stack = 5 credits/check · TrustedForm verify = +1 credit.
The amount a customer is actually charged comes from the **Dodo dashboard product**, not this file.
If you enable real (live_mode) checkout before updating Dodo, customers will be charged the OLD product
prices while the site advertises the new ones.

- [ ] Update the three Dodo products (mapped via `DODO_PRODUCT_STARTER/_GROWTH/_PRO`) to $299 / $899 / $2,399 per month
- [ ] Confirm granted credit amounts in the webhook flow match 30,000 / 120,000 / 400,000 (granted from `PLANS[plan].credits`)
- [ ] Run one end-to-end test-mode checkout per plan and verify price + granted credits before switching to live_mode
- [ ] Legal pages: now drafted at /legal/* — still require counsel review before launch

## 7. Production hardening (SOC 2 trajectory)

- [ ] Move keys/accounts/audit from `.data/*.json` to Postgres (Prisma models already defined)
- [ ] Add email OTP on signup (sendgrid/resend) before key issuance
- [ ] Enable Vercel log drains → retained logs (SOC 2 CC7.2)
- [ ] Add `/api/v1/gate/audit/chain` verification to a daily cron job
- [ ] Incident response one-pager + backup/restore runbook

## Data hygiene & history scrub

`.data/` is local-development state only and is never committed. The files still
exist in earlier Git history (commits before this change), which contains real
customer emails in `keys.json` and `payments.jsonl`.

If this GitHub repository is public, or will ever be made public or shared, purge
the earlier history with `git filter-repo --path .data --path apps/verifyone/.data --invert-paths`, followed
by a force push and rotation of any affected keys. This is a manual,
repository-owner-run step; it is not performed by this change.
