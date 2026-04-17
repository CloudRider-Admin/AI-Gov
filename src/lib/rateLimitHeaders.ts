/**
 * Standard rate limit response headers.
 *
 * Attaches X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset,
 * and Retry-After to API responses per IETF draft-ietf-httpapi-ratelimit-headers.
 */

import type { RateLimitResult } from './rate-limit';

/**
 * Build rate limit headers from a RateLimitResult.
 * Returns a plain object suitable for spreading into NextResponse headers.
 */
export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const remaining = Number.isFinite(result.remaining) ? result.remaining : 999999;
  const limit = Number.isFinite(result.limit) ? result.limit : 999999;

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
  };

  if (result.resetAt) {
    headers['X-RateLimit-Reset'] = String(result.resetAt);
  }

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}
