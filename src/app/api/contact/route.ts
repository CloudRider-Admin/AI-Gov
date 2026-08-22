import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkIpRateLimit } from '@/lib/rate-limit';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(100),
  message: z.string().min(10).max(5000),
});

export async function POST(request: NextRequest) {
  // Spam throttle: 5 messages per IP per hour
  const rate = await checkIpRateLimit(request, 'contact', 5, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 3600) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email, subject, message } = parsed.data;

  // Log to console in development; swap for an email provider (Resend, SendGrid, etc.) in production.
  console.info('[contact]', { name, email, subject, messageLength: message.length });

  return NextResponse.json({ ok: true }, { status: 200 });
}
