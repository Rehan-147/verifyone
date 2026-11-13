export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PLANS, PLAN_ORDER } from '../../../../lib/plans';
import { dodoConfigured } from '../../../../lib/dodo';

export async function GET() {
  return NextResponse.json({
    processor: 'dodo_payments',
    merchant_of_record: true,
    configured: dodoConfigured(),
    checkout: 'POST /api/billing/checkout',
    webhook: 'POST /api/webhooks/dodo',
    plans: PLAN_ORDER.map((key) => ({ billing_key: key, ...PLANS[key] })),
  });
}
