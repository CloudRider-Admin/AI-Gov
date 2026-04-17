/**
 * Token budget tracking per user.
 *
 * Tracks OpenAI token consumption and enforces monthly budgets per plan tier.
 * Usage is stored in the TokenUsage table and checked before expensive calls.
 */

import { prisma } from '@/lib/prisma';
import { encode } from 'gpt-tokenizer';

// Monthly token budgets per plan (prompt + completion combined)
const MONTHLY_TOKEN_BUDGETS: Record<string, number> = {
  GUEST: 2_000,       // single demo query
  FREE:  20_000,      // ~5 queries × 4k tokens avg
  PRO:   500_000,     // ~125 queries
  TEAM:  2_000_000,   // ~500 queries
  ENTERPRISE: 10_000_000,
  ADMIN: Infinity,
};

const DEFAULT_BUDGET = MONTHLY_TOKEN_BUDGETS.FREE;

export interface TokenBudgetResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export interface TokenRecord {
  userId: string;
  endpoint: string;
  promptTokens: number;
  completionTokens: number;
  model?: string;
}

/**
 * Check whether a user has remaining token budget for the current billing month.
 */
export async function checkTokenBudget(userId: string, role = 'FREE'): Promise<TokenBudgetResult> {
  const budget = MONTHLY_TOKEN_BUDGETS[role] ?? DEFAULT_BUDGET;
  if (budget === Infinity) {
    return { allowed: true, used: 0, limit: budget, remaining: budget };
  }

  const monthStart = getMonthStart();
  const used = await getMonthlyUsage(userId, monthStart);

  return {
    allowed: used < budget,
    used,
    limit: budget,
    remaining: Math.max(0, budget - used),
  };
}

/**
 * Record token usage after an OpenAI call completes.
 * Fire-and-forget — failures are logged but don't block the response.
 */
export function recordTokenUsage(record: TokenRecord): void {
  const totalTokens = record.promptTokens + record.completionTokens;

  prisma.tokenUsage.create({
    data: {
      userId: record.userId,
      endpoint: record.endpoint,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      totalTokens,
      model: record.model ?? 'gpt-4o',
    },
  }).catch((err: unknown) => {
    console.error('[tokenBudget] Failed to record usage:', err);
  });
}

/**
 * Get total tokens used by a user since the given date.
 */
async function getMonthlyUsage(userId: string, since: Date): Promise<number> {
  const result = await prisma.tokenUsage.aggregate({
    where: { userId, createdAt: { gte: since } },
    _sum: { totalTokens: true },
  });
  return result._sum.totalTokens ?? 0;
}

/**
 * Returns the first day of the current month at midnight UTC.
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Accurate token count using gpt-tokenizer (cl100k_base encoding).
 * Falls back to heuristic estimate if tokenizer throws.
 */
export function countTokens(text: string): number {
  try {
    return encode(text).length;
  } catch {
    // Fallback: ~4 chars per token for English text
    return Math.ceil(text.length / 4);
  }
}

// Re-export for testing
export { MONTHLY_TOKEN_BUDGETS, getMonthStart };
