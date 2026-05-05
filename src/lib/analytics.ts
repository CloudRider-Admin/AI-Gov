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

export interface EndpointStat {
  endpoint: string;
  count: number;               // total calls in the window
  successRate: number;         // 0–100 (% of calls without paired error event)
  avgPayloadKb: number;        // avg total tokens × ~4 bytes / 1024
  trend: 'up' | 'down' | 'flat';
}

export interface SystemHealth {
  clusterUptimePct: number;    // 100 - errorRate (clamped)
  latencyP99Ms: number;        // measured DB round-trip (proxy)
  errorRate: number;           // 0–100 over last 24h
  verdict: 'Optimal' | 'Degraded' | 'Slow';
}

export interface HourlyTokenBucket {
  hour: string;                // ISO hour start "YYYY-MM-DDTHH:00"
  input: number;
  output: number;
}

export interface DashboardStats {
  totalQueries: number;
  totalArtifacts: number;
  totalUsers: number;
  activeUsersToday: number;
  queriesLast7Days: number[];
  queriesPrev7Days: number[];
  artifactsByType: Record<string, number>;
  artifactTotal: number;
  topEndpoints: EndpointStat[];
  tokenUsageByDay: Array<{ date: string; tokens: number }>;
  tokenUsageHourly: HourlyTokenBucket[];
  systemHealth: SystemHealth;
  errorRate: number;
  avgResponseTimeMs: number;
  deltas: {
    totalQueriesPct: number;    // last 24h vs prior 24h
    totalArtifactsPct: number;
    totalUsersPct: number;
    activeTodayPct: number;
  };
}

/**
 * Fetch dashboard statistics for the admin analytics page.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prev24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Measure DB round-trip for latency proxy
  const dbStart = Date.now();
  await prisma.$queryRawUnsafe('SELECT 1').catch(() => null);
  const latencyP99Ms = Date.now() - dbStart;

  const [
    totalQueries,
    totalArtifacts,
    totalUsers,
    activeUsersTodayGroups,
    queriesByDay,
    artifactsByType,
    tokensByDay,
    tokensHourlyRaw,
    errorCount,
    totalEventsLast24h,
    queries24h,
    queriesPrev24h,
    artifacts24h,
    artifactsPrev24h,
    users24h,
    usersPrev24h,
    errorsByEndpointRaw,
    activeTodayCount,
    activeYesterdayCount,
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
      const convIds = groups.map((g) => g.conversationId);
      const convs = await prisma.conversation.findMany({
        where: { id: { in: convIds } },
        select: { userId: true },
        distinct: ['userId'],
      });
      return convs.length;
    }),

    // Queries per day — last 14 days (so we can split into last 7 + prior 7)
    prisma.$queryRawUnsafe<Array<{ day: Date; count: bigint }>>(
      `SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as count
       FROM "Message"
       WHERE "role" = 'user' AND "createdAt" >= $1
       GROUP BY DATE_TRUNC('day', "createdAt")
       ORDER BY day ASC`,
      fourteenDaysAgo,
    ),

    // Artifacts by type
    prisma.generatedArtifact.groupBy({
      by: ['type'],
      _count: true,
    }),

    // Token usage by day (last 7)
    prisma.$queryRawUnsafe<Array<{ day: Date; tokens: bigint }>>(
      `SELECT DATE_TRUNC('day', "createdAt") as day, SUM("totalTokens") as tokens
       FROM "TokenUsage"
       WHERE "createdAt" >= $1
       GROUP BY DATE_TRUNC('day', "createdAt")
       ORDER BY day ASC`,
      sevenDaysAgo,
    ),

    // Token usage by hour (last 24h, input vs output)
    prisma.$queryRawUnsafe<Array<{ hour: Date; input: bigint; output: bigint }>>(
      `SELECT DATE_TRUNC('hour', "createdAt") as hour,
              SUM("promptTokens") as input,
              SUM("completionTokens") as output
       FROM "TokenUsage"
       WHERE "createdAt" >= $1
       GROUP BY DATE_TRUNC('hour', "createdAt")
       ORDER BY hour ASC`,
      last24h,
    ),

    // Error events (last 24h)
    prisma.analyticsEvent.count({
      where: { event: 'error', createdAt: { gte: last24h } },
    }),

    // Total events last 24h
    prisma.analyticsEvent.count({ where: { createdAt: { gte: last24h } } }),

    // Delta windows
    prisma.message.count({ where: { role: 'user', createdAt: { gte: last24h } } }),
    prisma.message.count({
      where: { role: 'user', createdAt: { gte: prev24h, lt: last24h } },
    }),
    prisma.generatedArtifact.count({ where: { createdAt: { gte: last24h } } }),
    prisma.generatedArtifact.count({
      where: { createdAt: { gte: prev24h, lt: last24h } },
    }),
    prisma.user.count({ where: { createdAt: { gte: last24h } } }),
    prisma.user.count({ where: { createdAt: { gte: prev24h, lt: last24h } } }),

    // Errors by endpoint category (for per-endpoint success rate)
    prisma.analyticsEvent.groupBy({
      by: ['category'],
      where: { event: 'error', createdAt: { gte: last24h } },
      _count: true,
    }),

    // Active today (distinct users with any analytics event today)
    prisma.analyticsEvent
      .findMany({
        where: { createdAt: { gte: todayStart }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      })
      .then((r: { userId: string | null }[]) => r.length),

    // Active yesterday (for delta)
    prisma.analyticsEvent
      .findMany({
        where: {
          createdAt: { gte: new Date(todayStart.getTime() - 24 * 60 * 60 * 1000), lt: todayStart },
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      })
      .then((r: { userId: string | null }[]) => r.length),
  ]);

  // Build 7-day arrays — queriesLast7Days (index 0 = 7 days ago, 6 = yesterday)
  const queriesLast7Days: number[] = [];
  const queriesPrev7Days: number[] = [];
  for (let i = 0; i < 7; i++) {
    const dayLast = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayLastStr = dayLast.toISOString().slice(0, 10);
    const dayPrev = new Date(fourteenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayPrevStr = dayPrev.toISOString().slice(0, 10);
    const matchLast = queriesByDay.find((q) => q.day.toISOString().slice(0, 10) === dayLastStr);
    const matchPrev = queriesByDay.find((q) => q.day.toISOString().slice(0, 10) === dayPrevStr);
    queriesLast7Days.push(matchLast ? Number(matchLast.count) : 0);
    queriesPrev7Days.push(matchPrev ? Number(matchPrev.count) : 0);
  }

  // Artifacts by type map + total
  const artifactsByTypeMap: Record<string, number> = {};
  let artifactTotal = 0;
  for (const g of artifactsByType) {
    artifactsByTypeMap[g.type] = g._count;
    artifactTotal += g._count;
  }

  // Token usage by day
  const tokenUsageByDay = tokensByDay.map((t) => ({
    date: t.day.toISOString().slice(0, 10),
    tokens: Number(t.tokens),
  }));

  // Token usage by hour (fill empty hours with zeros so the chart has 24 buckets)
  const hourlyMap = new Map<string, { input: number; output: number }>();
  for (const row of tokensHourlyRaw) {
    const key = row.hour.toISOString().slice(0, 13) + ':00';
    hourlyMap.set(key, { input: Number(row.input), output: Number(row.output) });
  }
  const tokenUsageHourly: HourlyTokenBucket[] = [];
  for (let i = 23; i >= 0; i--) {
    const h = new Date(now.getTime() - i * 60 * 60 * 1000);
    h.setUTCMinutes(0, 0, 0);
    const key = h.toISOString().slice(0, 13) + ':00';
    const bucket = hourlyMap.get(key) ?? { input: 0, output: 0 };
    tokenUsageHourly.push({ hour: key, input: bucket.input, output: bucket.output });
  }

  // Errors by category map (used for per-endpoint success rate approximation)
  const errorsByCategory = new Map<string, number>();
  for (const e of errorsByEndpointRaw) {
    errorsByCategory.set(e.category, e._count as number);
  }

  // Top endpoints with enriched metrics
  const topEndpointsRaw = await prisma.tokenUsage.groupBy({
    by: ['endpoint'],
    _count: true,
    _avg: { totalTokens: true },
    orderBy: { _count: { endpoint: 'desc' } },
    take: 5,
    where: { createdAt: { gte: last24h } },
  });

  // 24h-prior window for endpoint trend
  const topEndpointsPrev = await prisma.tokenUsage.groupBy({
    by: ['endpoint'],
    _count: true,
    where: { createdAt: { gte: prev24h, lt: last24h } },
  });
  const prevCountByEndpoint = new Map<string, number>();
  for (const e of topEndpointsPrev) {
    prevCountByEndpoint.set(e.endpoint, e._count as number);
  }

  const topEndpoints: EndpointStat[] = topEndpointsRaw.map((e) => {
    const endpoint = e.endpoint;
    const count = e._count as number;
    const errs = errorsByCategory.get(endpoint) ?? 0;
    const successRate = count > 0 ? Math.max(0, Math.round(((count - errs) / count) * 1000) / 10) : 100;
    const avgTokens = e._avg?.totalTokens ?? 0;
    // Rough payload-size estimate: 1 token ≈ 4 bytes of request/response text.
    const avgPayloadKb = Math.round((avgTokens * 4) / 1024 * 10) / 10;
    const prev = prevCountByEndpoint.get(endpoint) ?? 0;
    const delta = count - prev;
    const trend: 'up' | 'down' | 'flat' =
      Math.abs(delta) < Math.max(1, count * 0.05) ? 'flat' : delta > 0 ? 'up' : 'down';
    return { endpoint, count, successRate, avgPayloadKb, trend };
  });

  const errorRate =
    totalEventsLast24h > 0 ? Math.round((errorCount / totalEventsLast24h) * 1000) / 10 : 0;

  // System health
  const clusterUptimePct = Math.max(0, Math.min(100, 100 - errorRate));
  let verdict: SystemHealth['verdict'] = 'Optimal';
  if (latencyP99Ms > 400 || errorRate > 5) verdict = 'Slow';
  else if (latencyP99Ms > 180 || errorRate > 1) verdict = 'Degraded';

  const pct = (curr: number, prev: number): number => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  return {
    totalQueries,
    totalArtifacts,
    totalUsers,
    activeUsersToday: activeUsersTodayGroups as number,
    queriesLast7Days,
    queriesPrev7Days,
    artifactsByType: artifactsByTypeMap,
    artifactTotal,
    topEndpoints,
    tokenUsageByDay,
    tokenUsageHourly,
    systemHealth: {
      clusterUptimePct: Math.round(clusterUptimePct * 10000) / 10000,
      latencyP99Ms,
      errorRate,
      verdict,
    },
    errorRate,
    avgResponseTimeMs: latencyP99Ms,
    deltas: {
      totalQueriesPct: pct(queries24h, queriesPrev24h),
      totalArtifactsPct: pct(artifacts24h, artifactsPrev24h),
      totalUsersPct: pct(users24h, usersPrev24h),
      activeTodayPct: pct(activeTodayCount, activeYesterdayCount),
    },
  };
}