# Dodo Payments setup (VerifyOne billing)

Merchant of record: Dodo Payments — https://docs.dodopayments.com

## Products (map to env)

| Display | Price | Env | Key |
|---------|-------|-----|-----|
| Agent Shield | $49/mo | DODO_PRODUCT_STARTER | STARTER |
| Agency Shield | $199/mo | DODO_PRODUCT_GROWTH | GROWTH |
| Compliance Pro | $499/mo | DODO_PRODUCT_PRO | PRO |

Webhook: POST /api/webhooks/dodo
Checkout: POST /api/billing/checkout
Catalog: GET /api/billing/plans
