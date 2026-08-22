import { prisma } from '@/lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

// Retention windows for periodic cleanup.
const RATE_LIMIT_RETENTION_MS = 2 * DAY_MS;    // limiter windows are ≤ 24h
const TOKEN_USAGE_RETENTION_MS = 90 * DAY_MS;  // keep ~a quarter of usage history
const ANALYTICS_RETENTION_MS = 180 * DAY_MS;   // keep ~6 months of analytics

export interface CleanupResult {
  verificationTokens: number;
  passwordResetTokens: number;
  rateLimits: number;
  tokenUsage: number;
  analyticsEvents: number;
}

/**
 * Delete expired auth tokens and time-expired operational rows. Idempotent and
 * safe to run repeatedly. `now` is injectable for testing.
 */
export async function runCleanup(now: Date = new Date()): Promise<CleanupResult> {
  const nowMs = now.getTime();

  const [verificationTokens, passwordResetTokens, rateLimits, tokenUsage, analyticsEvents] =
    await Promise.all([
      prisma.verificationToken.deleteMany({ where: { expires: { lt: now } } }),
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.rateLimit.deleteMany({
        where: { createdAt: { lt: new Date(nowMs - RATE_LIMIT_RETENTION_MS) } },
      }),
      prisma.tokenUsage.deleteMany({
        where: { createdAt: { lt: new Date(nowMs - TOKEN_USAGE_RETENTION_MS) } },
      }),
      prisma.analyticsEvent.deleteMany({
        where: { createdAt: { lt: new Date(nowMs - ANALYTICS_RETENTION_MS) } },
      }),
    ]);

  return {
    verificationTokens: verificationTokens.count,
    passwordResetTokens: passwordResetTokens.count,
    rateLimits: rateLimits.count,
    tokenUsage: tokenUsage.count,
    analyticsEvents: analyticsEvents.count,
  };
}
