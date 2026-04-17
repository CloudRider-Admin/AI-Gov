import Stripe from 'stripe';

// Lazily initialised so the build succeeds without env vars.
// API routes will receive a runtime error if the key is missing.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Add it to your environment variables.');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return _stripe;
}

export const STRIPE_PRICES = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  PRO_ANNUAL: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
  TEAM_MONTHLY: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID!,
  TEAM_ANNUAL: process.env.STRIPE_TEAM_ANNUAL_PRICE_ID!,
} as const;

export function getRoleForPriceId(priceId: string): 'PRO' | 'TEAM' {
  const teamPrices = [
    process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
    process.env.STRIPE_TEAM_ANNUAL_PRICE_ID,
  ].filter(Boolean);
  return teamPrices.includes(priceId) ? 'TEAM' : 'PRO';
}
