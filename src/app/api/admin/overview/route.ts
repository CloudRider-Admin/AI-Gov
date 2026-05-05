import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface AdminOverview {
  systemStatus: 'operational' | 'degraded' | 'down';
  generatedAt: string;
  knowledge: {
    total: number;
    embedded: number;
    pending: number;
    lastUpdatedAt: string | null;
  };
  users: {
    total: number;
    activeToday: number;
    contributorsLast7Days: number;
  };
  compliance: {
    score: number;     // % of active KB entries embedded
    deltaPct: number;  // change vs 24h ago
  };
  latency: {
    dbMs: number;      // measured round-trip on this request
    verdict: 'Optimal' | 'Degraded' | 'Slow';
  };
  sessions: {
    activeNow: number; // distinct users active in last 15 min
  };
  errorRate24h: number;
}

async function measureDbLatency(): Promise<number> {
  const start = Date.now();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    return -1;
  }
  return Date.now() - start;
}

export async function GET() {
  const session = await getOptionalSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [
      kbTotal,
      kbEmbedded,
      kbLatest,
      kbEmbeddedPriorDay,
      kbTotalPriorDay,
      totalUsers,
      activeTodayConvs,
      contributorGroups,
      activeNowGroups,
      errorCount24h,
      totalEvents24h,
      dbMs,
    ] = await Promise.all([
      prisma.knowledgeEntry.count({ where: { isActive: true } }),
      prisma.knowledgeEntry.count({ where: { isActive: true, embeddedAt: { not: null } } }),
      prisma.knowledgeEntry.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      // Entries embedded before 24h ago — used to compute compliance delta
      prisma.knowledgeEntry.count({
        where: { isActive: true, embeddedAt: { not: null, lt: oneDayAgo } },
      }),
      prisma.knowledgeEntry.count({
        where: { isActive: true, createdAt: { lt: oneDayAgo } },
      }),
      prisma.user.count(),
      prisma.message
        .groupBy({ by: ['conversationId'], where: { createdAt: { gte: todayStart } } })
        .then(async (groups: { conversationId: string }[]) => {
          if (groups.length === 0) return [] as { userId: string }[];
          return prisma.conversation.findMany({
            where: { id: { in: groups.map((g) => g.conversationId) } },
            select: { userId: true },
            distinct: ['userId'],
          });
        }),
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: fifteenMinAgo }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.analyticsEvent.count({
        where: { event: 'error', createdAt: { gte: oneDayAgo } },
      }),
      prisma.analyticsEvent.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      measureDbLatency(),
    ]);

    // Compliance score: % of active KB entries embedded
    const score = kbTotal > 0 ? Math.round((kbEmbedded / kbTotal) * 1000) / 10 : 0;
    const priorScore =
      kbTotalPriorDay > 0 ? Math.round((kbEmbeddedPriorDay / kbTotalPriorDay) * 1000) / 10 : 0;
    const deltaPct = Math.round((score - priorScore) * 10) / 10;

    // Latency verdict — DB round-trip is the dominant cost on this path
    let verdict: 'Optimal' | 'Degraded' | 'Slow' = 'Optimal';
    if (dbMs < 0) verdict = 'Slow';
    else if (dbMs > 400) verdict = 'Slow';
    else if (dbMs > 180) verdict = 'Degraded';

    const errorRate24h =
      totalEvents24h > 0 ? Math.round((errorCount24h / totalEvents24h) * 1000) / 10 : 0;

    let systemStatus: AdminOverview['systemStatus'] = 'operational';
    if (dbMs < 0) systemStatus = 'down';
    else if (errorRate24h > 5 || verdict === 'Slow') systemStatus = 'degraded';

    const overview: AdminOverview = {
      systemStatus,
      generatedAt: now.toISOString(),
      knowledge: {
        total: kbTotal,
        embedded: kbEmbedded,
        pending: Math.max(0, kbTotal - kbEmbedded),
        lastUpdatedAt: kbLatest?.updatedAt.toISOString() ?? null,
      },
      users: {
        total: totalUsers,
        activeToday: activeTodayConvs.length,
        contributorsLast7Days: contributorGroups.length,
      },
      compliance: { score, deltaPct },
      latency: { dbMs: Math.max(0, dbMs), verdict },
      sessions: { activeNow: activeNowGroups.length },
      errorRate24h,
    };

    return NextResponse.json(overview, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[admin/overview] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}