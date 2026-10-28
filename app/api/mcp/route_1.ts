// MCP Server for AI Agents - Claude / Cursor
// URL: https://app.verifyone.io/api/mcp
import { NextRequest, NextResponse } from 'next/server'
const TOOLS = [
  { name:'validate_phone', description:'Validate phone carrier, line type, DNC, risk', inputSchema:{type:'object', properties:{phone:{type:'string'}}, required:['phone']} },
  { name:'verify_email', description:'Verify email valid/disposable/catch-all fraud score', inputSchema:{type:'object', properties:{email:{type:'string'}}, required:['email']} },
  { name:'ip_lookup', description:'IP geolocation fraud proxy detection', inputSchema:{type:'object', properties:{ip:{type:'string'}}, required:['ip']} },
  { name:'bulk_verify', description:'Bulk verify up to 2000 rows', inputSchema:{type:'object', properties:{items:{type:'array'}}} },
  { name:'get_account', description:'Get credit balance and plan', inputSchema:{type:'object', properties:{}} }
]
export async function POST(req:NextRequest){
  const body = await req.json()
  if(body.method === 'tools/list') return NextResponse.json({tools:TOOLS})
  if(body.method === 'tools/call'){
    const {name, arguments:args} = body.params
    // In production: get userId from OAuth token, check cache, deduct credits
    const result = await fetch(`${process.env.APP_URL}/api/v1/validate`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(args)}).then(r=>r.json())
    return NextResponse.json({content:[{type:'text', text: JSON.stringify(result)}]})
  }
  return NextResponse.json({error:'unknown'}, {status:400})
}
