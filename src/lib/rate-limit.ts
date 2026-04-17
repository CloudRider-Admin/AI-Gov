import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';

// ─── Login Throttling ─────────────────────────────────────────────────────────

const LOGIN_ENDPOINT = 'auth:signin';
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_FAILURES = 5;

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until lockout expires
}

/**
 * Check whether an email is currently locked out due to too many failed logins.
 * Read-only — does not create any records.
 */
export async function checkLoginRateLimit(email: string): Promise<LoginRateLimitResult> {
  const key = `login:${email.toLowerCase()}`;
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS);

  const count = await prisma.rateLimit.count({
    where: { userId: key, endpoint: LOGIN_ENDPOINT, createdAt: { gte: windowStart } },
  });

  if (count >= LOGIN_MAX_FAILURES) {
    const oldest = await prisma.rateLimit.findFirst({
      where: { userId: key, endpoint: LOGIN_ENDPOINT, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
    });
    const retryAfter = oldest
      ? Math.ceil((oldest.createdAt.getTime() + LOGIN_WINDOW_MS - Date.now()) / 1000)
      : LOGIN_WINDOW_MS / 1000;
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  return { allowed: true };
}

/** Record one failed login attempt for the given email. */
export async function recordFailedLogin(email: string): Promise<void> {
  const key = `login:${email.toLowerCase()}`;
  await prisma.rateLimit.create({ data: { userId: key, endpoint: LOGIN_ENDPOINT } });
}

/** Clear all failed login attempts on successful authentication. */
export async function clearLoginAttempts(email: string): Promise<void> {
  const key = `login:${email.toLowerCase()}`;
  prisma.rateLimit
    .deleteMany({ where: { userId: key, endpoint: LOGIN_ENDPOINT } })
    .catch((err: unknown) => console.error('[rate-limit] Failed to clear login attempts:', err));
}

// ─── API Rate Limiting ────────────────────────────────────────────────────────

const RATE_LIMIT_CONFIG: Record<string, { maxRequests: number; windowMinutes: number }> = {
  GUEST: { maxRequests: 1,  windowMinutes: 1440 }, // 1 per day (IP-based)
  FREE:  { maxRequests: 5,  windowMinutes: 1440 }, // 5 per day
  PRO:   { maxRequests: 20, windowMinutes: 60 },   // 20 per hour
  TEAM:  { maxRequests: 50, windowMinutes: 60 },   // 50 per hour (shared across team)
};

const DEFAULT_CONFIG = RATE_LIMIT_CONFIG.FREE;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number; // seconds until window resets
  resetAt?: number;    // epoch seconds when window resets
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  role = 'FREE'
): Promise<RateLimitResult> {
  // Admins bypass rate limiting entirely
  if (role === 'ADMIN' || role === 'ENTERPRISE') {
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }

  const config = RATE_LIMIT_CONFIG[role] ?? DEFAULT_CONFIG;
  const windowMs = config.windowMinutes * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs);
  const resetAt = Math.ceil((windowStart.getTime() + windowMs) / 1000);

  // Atomic count-then-insert inside a serializable transaction to prevent race conditions
  const result = await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
    const count = await tx.rateLimit.count({
      where: {
        userId,
        endpoint,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= config.maxRequests) {
      const oldest = await tx.rateLimit.findFirst({
        where: { userId, endpoint, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'asc' },
      });

      const retryAfter = oldest
        ? Math.ceil((oldest.createdAt.getTime() + windowMs - Date.now()) / 1000)
        : config.windowMinutes * 60;

      return { allowed: false as const, remaining: 0, limit: config.maxRequests, retryAfter: Math.max(1, retryAfter), resetAt };
    }

    await tx.rateLimit.create({ data: { userId, endpoint } });

    return { allowed: true as const, remaining: config.maxRequests - count - 1, limit: config.maxRequests, resetAt };
  }, { isolationLevel: 'Serializable' });

  // Cleanup old records outside the transaction (fire-and-forget)
  prisma.rateLimit
    .deleteMany({ where: { userId, endpoint, createdAt: { lt: windowStart } } })
    .catch((err: unknown) => console.error('[rate-limit] Cleanup failed:', err));

  return result;
}
