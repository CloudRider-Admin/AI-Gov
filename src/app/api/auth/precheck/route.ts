import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '@/lib/rate-limit';

/**
 * Pre-check credentials before NextAuth signIn to return specific error codes.
 * NextAuth v4.24+ sanitises authorize() errors to generic "CredentialsSignin",
 * which hides EmailNotVerified / RateLimited feedback from the user.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
    }

    // Rate-limit check
    const rateCheck = await checkLoginRateLimit(email);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil((rateCheck.retryAfter ?? 900) / 60);
      return NextResponse.json({ ok: false, code: 'RATE_LIMITED', minutes }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.hashedPassword) {
      await recordFailedLogin(email);
      return NextResponse.json({ ok: false, code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      await recordFailedLogin(email);
      return NextResponse.json({ ok: false, code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ ok: false, code: 'EMAIL_NOT_VERIFIED' }, { status: 403 });
    }

    // Credentials are valid and email verified — clear failure counter
    clearLoginAttempts(email);
    return NextResponse.json({ ok: true, code: 'OK' });
  } catch (err) {
    console.error('[auth/precheck]', err);
    return NextResponse.json({ ok: false, code: 'SERVER_ERROR' }, { status: 500 });
  }
}