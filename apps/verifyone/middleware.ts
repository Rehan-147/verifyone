import { NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { clerkConfigured } from './lib/clerk';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api/dashboard(.*)']);

const withClerk = clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export default function middleware(req: NextRequest, event: import('next/server').NextFetchEvent) {
  if (!clerkConfigured()) {
    if (isProtectedRoute(req) && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 });
    }
    return NextResponse.next();
  }
  return withClerk(req, event);
}

export const config = {
  matcher: ['/dashboard(.*)', '/sign-in(.*)', '/sign-up(.*)', '/api/dashboard(.*)'],
};
