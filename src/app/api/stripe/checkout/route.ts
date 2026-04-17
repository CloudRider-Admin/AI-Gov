import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { getStripe, STRIPE_PRICES } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  priceId: z.enum(['PRO_MONTHLY', 'PRO_ANNUAL', 'TEAM_MONTHLY', 'TEAM_ANNUAL']),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid price selection.' }, { status: 400 });
  }

  const priceId = STRIPE_PRICES[parsed.data.priceId];
  if (!priceId) {
    return NextResponse.json(
      { error: 'Stripe price IDs are not configured. Add STRIPE_PRO_MONTHLY_PRICE_ID / STRIPE_PRO_ANNUAL_PRICE_ID to your environment.' },
      { status: 503 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true, stripeSubscriptionId: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  // Already on a paid plan — send them straight to the billing portal to manage
  if (['PRO', 'TEAM'].includes(user.role) && user.stripeSubscriptionId) {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId!,
      return_url: `${process.env.NEXTAUTH_URL}/pricing`,
    });
    return NextResponse.json({ url: portal.url });
  }

  // Get or create a Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email!,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
    subscription_data: {
      metadata: { userId: session.user.id },
    },
    metadata: { userId: session.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
