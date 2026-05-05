import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkTokenBudget } from '@/lib/tokenBudget';
import { prisma } from '@/lib/prisma';

// GPT-4o pricing (per 1K tokens) — update if model changes
const COST_PER_1K_PROMPT = 0.0025;    // $2.50 / 1M input
const COST_PER_1K_COMPLETION = 0.01;  // $10.00 / 1M output

export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role ?? 'FREE';
  const budget = await checkTokenBudget(session.user.id, role);

  // ── Detailed cost breakdown ──
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [monthlyRecords, dailyBreakdown, queryCount] = await Promise.all([
    // Aggregate totals for the month
    prisma.tokenUsage.aggregate({
      where: { userId: session.user.id, createdAt: { gte: monthStart } },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      _count: true,
    }),

    // Daily breakdown for chart
    prisma.$queryRawUnsafe<{ day: string; prompt_tokens: bigint; completion_tokens: bigint; queries: bigint }[]>(
      `SELECT
        DATE("createdAt") as day,
        SUM("promptTokens")::bigint as prompt_tokens,
        SUM("completionTokens")::bigint as completion_tokens,
        COUNT(*)::bigint as queries
      FROM "TokenUsage"
      WHERE "userId" = $1 AND "createdAt" >= $2
      GROUP BY DATE("createdAt")
      ORDER BY day ASC`,
      session.user.id,
      monthStart,
    ),

    // Total queries this month
    prisma.tokenUsage.count({
      where: { userId: session.user.id, createdAt: { gte: monthStart } },
    }),
  ]);

  const promptTokens = monthlyRecords._sum.promptTokens ?? 0;
  const completionTokens = monthlyRecords._sum.completionTokens ?? 0;
  const totalTokens = monthlyRecords._sum.totalTokens ?? 0;

  const estimatedCost =
    (promptTokens / 1000) * COST_PER_1K_PROMPT +
    (completionTokens / 1000) * COST_PER_1K_COMPLETION;

  const avgTokensPerQuery = queryCount > 0 ? Math.round(totalTokens / queryCount) : 0;
  const avgCostPerQuery = queryCount > 0 ? estimatedCost / queryCount : 0;

  // Days remaining in month
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate();
  const dayOfMonth = now.getUTCDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const dailyRate = dayOfMonth > 0 ? totalTokens / dayOfMonth : 0;
  const projectedMonthlyTokens = Math.round(dailyRate * daysInMonth);

  return NextResponse.json({
    // Basic budget (backward compat)
    used: budget.used,
    limit: budget.limit,
    remaining: budget.remaining,
    percentUsed: budget.limit === Infinity ? 0 : Math.round((budget.used / budget.limit) * 100),

    // Cost details
    cost: {
      estimatedCost: +estimatedCost.toFixed(4),
      avgCostPerQuery: +avgCostPerQuery.toFixed(4),
      avgTokensPerQuery,
      queryCount,
      promptTokens,
      completionTokens,
      projectedMonthlyTokens,
      daysRemaining,
      dailyBreakdown: dailyBreakdown.map((d: { day: string; prompt_tokens: bigint; completion_tokens: bigint; queries: bigint }) => ({
        day: d.day,
        promptTokens: Number(d.prompt_tokens),
        completionTokens: Number(d.completion_tokens),
        queries: Number(d.queries),
      })),
    },
  });
}