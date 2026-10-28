
import { NextResponse } from 'next/server';
import { validatePhone } from '../../../../lib/validators';
export async function POST(req: Request){ const {phone} = await req.json(); return NextResponse.json(validatePhone(phone)); }
