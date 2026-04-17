import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const base = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${base}/verify-email?error=missing`);
  }

  try {
    const record = await prisma.verificationToken.findUnique({ where: { token } });

    if (!record) {
      return NextResponse.redirect(`${base}/verify-email?error=invalid`);
    }

    if (record.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.redirect(`${base}/verify-email?error=expired`);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { email: record.identifier },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    return NextResponse.redirect(`${base}/signin?verified=1`);
  } catch (err) {
    console.error('[verify-email]', err);
    return NextResponse.redirect(`${base}/verify-email?error=server`);
  }
}
