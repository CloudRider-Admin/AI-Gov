import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/govi', '/playbooks', '/topics', '/dashboard'];

/**
 * Read the session token, treating any failure as "not signed in".
 *
 * next-auth <=4.24.14 (GHSA advisory on `getToken`) throws an uncaught exception
 * on a malformed `Authorization: Bearer` header. This middleware runs on
 * effectively every path, so an unhandled throw here is a 500 across the whole
 * application from one crafted request. Failing closed keeps that request
 * unauthenticated instead of taking the app down.
 *
 * Remove the guard only once the Auth.js v5 migration lands and the advisory no
 * longer applies — the fixed range starts above every v4 release.
 */
async function readToken(request: NextRequest, secret: string | undefined) {
  try {
    return await getToken({ req: request, secret });
  } catch (err) {
    console.error('[middleware] Rejecting request: session token could not be read:', err);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const secret = process.env.NEXTAUTH_SECRET;

  // Admin-only: /studio and /admin
  if (
    pathname === '/studio' || pathname.startsWith('/studio/') ||
    pathname === '/admin' || pathname.startsWith('/admin/')
  ) {
    const token = await readToken(request, secret);
    if (!token || token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
    return NextResponse.next();
  }

  // Auth-required routes
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!isProtected) return NextResponse.next();

  const token = await readToken(request, secret);
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
