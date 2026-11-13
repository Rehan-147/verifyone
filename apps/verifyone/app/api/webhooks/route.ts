import { NextRequest, NextResponse } from 'next/server'
export async function POST(req:NextRequest){
  const {user_id, url, events} = await req.json()
  const secret = 'whsec_' + Math.random().toString(36).slice(2,14)
  // In prod: supabaseAdmin.from('webhooks').insert(...)
  return NextResponse.json({user_id, url, events, secret})
}
async function triggerWebhook(userId:string, event:string, payload:any){
  // Fetch hooks from Supabase and POST to each
  // fetch(h.url, {method:'POST', headers:{'x-verifyone-signature': h.secret}, body: JSON.stringify({event, data:payload})})
}
