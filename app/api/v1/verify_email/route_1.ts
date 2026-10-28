
import { NextResponse } from 'next/server';
import { verifyEmail } from '../../../../lib/validators';
export async function POST(req: Request){ const {email} = await req.json(); return NextResponse.json(verifyEmail(email)); }
