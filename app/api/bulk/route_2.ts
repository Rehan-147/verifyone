// Instantly + Bulk Jobs + Webhooks
import { NextRequest, NextResponse } from 'next/server'
export async function POST(req:NextRequest){
  const {leads, user_id} = await req.json()
  const batchId = 'batch_' + Math.random().toString(36).slice(2,10)
  // In prod: insert into supabase bulk_jobs, push to Upstash QStash queue
  return NextResponse.json({batch_id: batchId, status:'accepted', total_rows: leads.length, poll_url:`/api/bulk/${batchId}`})
}
