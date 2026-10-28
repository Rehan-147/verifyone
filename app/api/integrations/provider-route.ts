import { NextRequest, NextResponse } from 'next/server'
import { handleIntegration } from '@/lib/integrations/adapter'
import { INTEGRATIONS } from '@/lib/integrations/catalog-100'
export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const payload = await req.json()
  const apiKey = req.headers.get('x-api-key') || payload.api_key || ''
  const integration = INTEGRATIONS.find(i => i.slug === params.provider)
  if (!integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
  const result = await handleIntegration(params.provider, payload, apiKey)
  return NextResponse.json(result)
}
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const integration = INTEGRATIONS.find(i => i.slug === params.provider)
  return NextResponse.json(integration || { error: 'not found' }, { status: integration ? 200 : 404 })
}
