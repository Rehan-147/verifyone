
import { NextResponse } from 'next/server';
import { ipLookup } from '../../../../lib/validators';
export async function POST(req: Request){ const {ip} = await req.json(); return NextResponse.json(ipLookup(ip)); }
