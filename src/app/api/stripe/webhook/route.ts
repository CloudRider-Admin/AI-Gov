import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, getRoleForPriceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

// Loose subscription type for fields that vary across Stripe API versions
type LooseSub = {
  id: string;
  status: string;
  items: { data: { price: { id: string } }[] };
  current_period_end?: number;
  metadata?: Record<string, string>;
};

// Loose invoice type
type LooseInvoice = {
  subscription?: string | { id: string } | null;
  subscription_id?: string | null;
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Webhook signature missing or secret not configured.' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Idempotency: claim this event id before processing. Stripe redelivers
  // events, and duplicates would otherwise re-run role/subscription mutations.
  // A concurrent or repeat delivery collides on the primary key and is skipped.
  try {
    await prisma.processedWebhookEvent.create({
      data: { id: event.id, provider: 'stripe', eventType: event.type },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('[stripe/webhook] Idempotency ledger error:', err);
    return NextResponse.json({ error: 'Webhook ledger error.' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event.data.object as any;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.userId;
        if (!userId) break;

        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as { id?: string } | null)?.id;
        if (!subId) break;

        const subRaw = await getStripe().subscriptions.retrieve(subId);
        const sub = subRaw as unknown as LooseSub;

        const priceId = sub.items.data[0].price.id;
        await prisma.user.update({
          where: { id: userId },
          data: {
            role: getRoleForPriceId(priceId),
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            ...(sub.current_period_end && {
              stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
            }),
          },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as unknown as LooseSub;
        const user = await prisma.user.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!user) break;

        const isActive = ['active', 'trialing'].includes(sub.status);
        const updatedPriceId = sub.items.data[0].price.id;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: isActive ? getRoleForPriceId(updatedPriceId) : 'FREE',
            stripePriceId: updatedPriceId,
            ...(sub.current_period_end && {
              stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
            }),
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as unknown as LooseSub;
        const user = await prisma.user.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!user) break;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'FREE',
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown as LooseInvoice;
        const subId =
          invoice.subscription_id ??
          (typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id);
        if (!subId) break;

        const user = await prisma.user.findUnique({ where: { stripeSubscriptionId: subId } });
        if (!user) break;

        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'FREE' },
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Processing failed — release the idempotency claim so Stripe's retry can
    // reprocess this event instead of it being skipped as a duplicate.
    await prisma.processedWebhookEvent
      .delete({ where: { id: event.id } })
      .catch(() => {});
    console.error(`[stripe/webhook] Error processing ${event.type}:`, err);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}