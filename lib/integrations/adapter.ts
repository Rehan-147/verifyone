
// Generic Integration Adapter - works for ALL 100
// Every integration uses one of 3 methods:
// 1. Native webhook (HubSpot, Pipedrive, Salesforce, Shopify, Stripe, Supabase)
// 2. Zapier/Make/n8n (all others via native Zapier app)
// 3. Direct API call (Google Sheets, Slack, Telegram)
import { supabaseAdmin } from '../supabase/client'

export async function handleIntegration(provider: string, payload: any, apiKey: string){
  // Lookup user by apiKey
  // const {data:user} = await supabaseAdmin.from('api_keys').select('user_id').eq('prefix', apiKey).single()
  const phone = payload.phone || payload.phone_number || payload.Phone
  const email = payload.email || payload.Email
  const ip = payload.ip || payload.IP

  const result = await fetch(`${process.env.APP_URL}/api/v1/validate`, {
    method:'POST', headers:{'x-api-key':apiKey, 'Content-Type':'application/json'},
    body: JSON.stringify({phone, email, ip})
  }).then(r=>r.json())

  // Log integration usage
  // await supabaseAdmin.from('integrations').upsert({provider, user_id: user.user_id, last_used: new Date()})
  return { provider, result, fields: { phone, email, ip } }
}

// Zapier/Make/n8n wrapper - same endpoint for all
export async function zapierHandler(provider:string, bundle:any){
  return handleIntegration(provider, bundle.inputData, bundle.authData.api_key)
}
