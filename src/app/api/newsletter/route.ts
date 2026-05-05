import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const { email } = parsed.data;

    // Silently succeed if already subscribed (no enumeration)
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (!existing) {
      await prisma.newsletterSubscriber.create({ data: { email } });
    }

    // Send welcome email via Resend if configured
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@govsecure.ai';

      await resend.emails.send({
        from,
        to: email,
        subject: 'You\'re subscribed to the GovSecure Monthly Briefing',
        html: `
          <div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:32px;border-radius:8px;max-width:480px">
            <h2 style="color:#00ff00;margin-top:0">Welcome to the Briefing</h2>
            <p>You&apos;re now subscribed to the <strong>GovSecure Monthly AI Governance Briefing</strong>.</p>
            <p>Each month you&apos;ll receive:</p>
            <ul style="color:#aaa;padding-left:20px">
              <li>Regulatory updates (EU AI Act, NIST, ISO 42001)</li>
              <li>New playbooks and governance guides</li>
              <li>Practical tips for SMB AI compliance</li>
            </ul>
            <p style="color:#888;font-size:12px;margin-top:24px">
              You can unsubscribe at any time by contacting us at hello@govsecure.ai.
            </p>
          </div>`,
      });
    } else {
      console.log(`[dev] Newsletter subscription: ${email}`);
    }

    return NextResponse.json({ message: 'Subscribed successfully.' });
  } catch (err) {
    console.error('[newsletter]', err);
    return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 });
  }
}
