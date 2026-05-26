import type { NextRequest } from 'next/server';

const PROVIDER_HEADERS = [
  'x-vercel-forwarded-for',
  'x-vercel-client-ip',
  'cf-connecting-ip',
  'true-client-ip',
] as const;

const FALLBACK_HEADERS = ['x-real-ip', 'x-forwarded-for'] as const;

export function getClientIp(request: NextRequest): string {
  for (const name of PROVIDER_HEADERS) {
    const value = request.headers.get(name);
    if (value) return value.split(',')[0].trim();
  }

  if (process.env.NODE_ENV === 'development' || process.env.TRUST_FORWARDED_HEADERS === '1') {
    for (const name of FALLBACK_HEADERS) {
      const value = request.headers.get(name);
      if (value) return value.split(',')[0].trim();
    }
  }

  return 'unknown';
}
