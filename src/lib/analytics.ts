/**
 * Analytics event tracking and aggregation.
 *
 * Dual-writes to both the audit log (existing) and the AnalyticsEvent table
 * for structured querying. Provides aggregation queries for the admin dashboard.
 */

import { prisma } from '@/lib/prisma';

// ─── Event Tracking ──────────────────────────────────────────────────────────

export interface TrackEventParams {
  userId?: string;
  event: string;
  category: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track an analytics event. Fire-and-forget.
 */
export function trackEvent(params: TrackEventParams): void {
  prisma.analyticsEvent.create({
    data: {
      userId: params.userId ?? null,
      event: params.event,
      category: params.category,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  }).catch((err: unknown) => {
    console.error('[analytics] Failed to track event:', err);
  });
}

// ─── Aggregation Queries ─────────────────────────────────────────────────────

export interface DashboardStats {
  totalQueries: number;
  totalArtifacts: number;
  totalUsers: number;
  activeUsersToday: number;
  queriesLast7Days: number[];      // [day0, day1, ..., day6] (oldest → newest)
  artifactsByType: Record<string, number>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  tokenUsageByDay: Array<{ date: string; tokens: number }>;
  errorRate: number;               // percentage (0-100)
  avgResponseTimeMs: number;
}

/**
 * Fetch dashboard statistics for the admin analytics page.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run aggregation queries in parallel
  const [
    totalQueries,
    totalArtifacts,
    totalUsers,
    activeUsersToday,
    queriesByDay,
    artifactsByType,
    tokensByDay,
    errorCount,
    totalEventsLast24h,
  ] = await Promise.all([
    // Total queries (all time)
    prisma.message.count({ where: { role: 'user' } }),

    // Total artifacts
    prisma.generatedArtifact.count(),

    // Total users
    prisma.user.count(),

    // Active users today
    prisma.message.groupBy({
      by: ['conversationId'],
      where: { createdAt: { gte: todayStart } },
    }).then(async (groups: { conversationId: string }[]) => {
      if (groups.length === 0) return 0;
      const convIds = groups.map((g: { conversationId: string }) => g.conversationId);
      const convs = await prisma.conversation.findMany({
        where: { id: { in: convIds } },
        select: { userId: true },
        distinct: ['userId'],
      });
      return convs.length;
    }),

    // Queries per day (last 7 days)
    prisma.$queryRawUnsafe<Array<{ day: Date; count: bigint }>>(
      `SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as count
       FROM "Message"
       WHERE "role" = 'user' AND "createdAt" >= $1
       GROUP BY DATE_TRUNC('day', "createdAt")
       ORDER BY day ASC`,
      sevenDaysAgo,
    ),

    // Artifacts by type
    prisma.generatedArtifact.groupBy({
      by: ['type'],
      _count: true,
    }),

    // Token usage by day (last 7 days)
    prisma.$queryRawUnsafe<Array<{ day: Date; tokens: bigint }>>(
      `SELECT DATE_TRUNC('day', "createdAt") as day, SUM("totalTokens") as tokens
       FROM "TokenUsage"
       WHERE "createdAt" >= $1
       GROUP BY DATE_TRUNC('day', "createdAt")
       ORDER BY day ASC`,
      sevenDaysAgo,
    ),

    // Error events (last 24h)
    prisma.analyticsEvent.count({
      where: {
        event: 'error',
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),

    // Total events last 24h (for error rate)
    prisma.analyticsEvent.count({
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Build 7-day query array
  const queriesLast7Days: number[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayStr = dayDate.toISOString().slice(0, 10);
    const match = queriesByDay.find((q: { day: Date; count: bigint }) => q.day.toISOString().slice(0, 10) === dayStr);
    queriesLast7Days.push(match ? Number(match.count) : 0);
  }

  // Build artifacts by type map
  const artifactsByTypeMap: Record<string, number> = {};
  for (const g of artifactsByType) {
    artifactsByTypeMap[g.type] = g._count;
  }

  // Token usage by day
  const tokenUsageByDay = tokensByDay.map((t: { day: Date; tokens: bigint }) => ({
    date: t.day.toISOString().slice(0, 10),
    tokens: Number(t.tokens),
  }));

  // Top endpoints from TokenUsage
  const topEndpoints = await prisma.tokenUsage.groupBy({
    by: ['endpoint'],
    _count: true,
    orderBy: { _count: { endpoint: 'desc' } },
    take: 5,
  });

  return {
    totalQueries,
    totalArtifacts,
    totalUsers,
    activeUsersToday,
    queriesLast7Days,
    artifactsByType: artifactsByTypeMap,
    topEndpoints: topEndpoints.map((e: { endpoint: string; _count: number }) => ({ endpoint: e.endpoint, count: e._count })),
    tokenUsageByDay,
    errorRate: totalEventsLast24h > 0 ? Math.round((errorCount / totalEventsLast24h) * 100 * 10) / 10 : 0,
    avgResponseTimeMs: 0, // Will be populated from analytics events once tracking is mature
  };
}
