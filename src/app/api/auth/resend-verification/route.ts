import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const schema = z.object({ email: z.string().email() });

const OK = NextResponse.json({
  message: 'If that email exists and is unverified, a new link has been sent.',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return OK;

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) return OK;

    // Rate-limit: only allow resend if no token was created in the last 2 minutes
    const recent = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        expires: { gt: new Date(Date.now() + 23 * 60 * 60 * 1000 + 58 * 60 * 1000) },
      },
    });
    if (recent) return OK;

    // Rotate token
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
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
        html: buildEmailHtml(user.name ?? 'there', verifyUrl),
      });
      if (sendError) {
        console.error('[resend-verification] Resend error:', sendError);
      }
    } else {
      console.log(`[dev] Email verification link for ${email}:\n  ${verifyUrl}`);
    }

    return OK;
  } catch (err) {
    console.error('[resend-verification]', err);
    return OK;
  }
}

function buildEmailHtml(name: string, verifyUrl: string) {
  return `
    <div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:32px;border-radius:8px;max-width:480px">
      <h2 style="color:#00ff88;margin-top:0">Verify Your Email</h2>
      <p>Hi ${name},</p>
      <p>Click the button below to verify your GovSecure account email address.</p>
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
