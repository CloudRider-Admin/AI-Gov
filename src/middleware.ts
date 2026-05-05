import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/govi', '/playbooks', '/topics', '/dashboard'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const secret = process.env.NEXTAUTH_SECRET;

  // Admin-only: /studio and /admin
  if (
    pathname === '/studio' || pathname.startsWith('/studio/') ||
    pathname === '/admin' || pathname.startsWith('/admin/')
  ) {
    const token = await getToken({ req: request, secret });
    if (!token || token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
    return NextResponse.next();
  }

  // Auth-required routes
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req: request, secret });
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/signup';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
