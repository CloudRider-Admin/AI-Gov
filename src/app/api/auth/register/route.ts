import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export async function POST(request: NextRequest) {
  try {
    // CSRF protection: verify request origin
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const parseResult = registerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: { name, email, hashedPassword },
    });

    // Generate email verification token
    const rawToken = randomBytes(32).toString('hex');
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: rawToken,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${rawToken}`;

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@govsecure.ai',
        to: email,
        subject: 'Verify your GovSecure email',
        html: buildVerifyHtml(name, verifyUrl),
      });
      if (sendError) {
        console.error('[register] Resend error:', sendError);
        return NextResponse.json(
          { message: 'Account created', emailSent: false, emailError: 'Verification email could not be sent. You can request a new one from the verification page.' },
          { status: 201 }
        );
      }
    } else {
      console.log(`[dev] Email verification link for ${email}:\n  ${verifyUrl}`);
    }

    return NextResponse.json({ message: 'Account created', emailSent: true }, { status: 201 });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

function buildVerifyHtml(name: string, verifyUrl: string) {
  return `
    <div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:32px;border-radius:8px;max-width:480px">
      <h2 style="color:#00ff88;margin-top:0">Verify Your Email</h2>
      <p>Hi ${name},</p>
      <p>Welcome to GovSecure! Click the button below to verify your email address.</p>
      <p><strong>This link expires in 24 hours.</strong></p>
      <a href="${verifyUrl}"
         style="display:inline-block;background:#00ff88;color:#0a0a0a;padding:12px 24px;
                text-decoration:none;border-radius:4px;margin:16px 0;font-weight:bold">
        Verify Email
      </a>
      <p style="color:#888;font-size:12px">
        If you didn&apos;t create a GovSecure account, you can safely ignore this email.
      </p>
      <p style="color:#555;font-size:11px;word-break:break-all">
        Or copy this link: ${verifyUrl}
      </p>
    </div>`;
}
