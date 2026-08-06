import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';
import { listAiSystems } from '@/lib/aiSystems';
import { getAllPostures } from '@/lib/compliance';
import { computeMaturity } from '@/lib/maturity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface RecentConversation {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  riskLevel: string | null;
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  event: string;
  category: string;
  tone: 'info' | 'warn' | 'error' | 'success';
  summary: string;
}

export interface FrameworkUsage {
  name: string;
  percent: number;   // 0-100
  count: number;
  tone: 'green' | 'amber' | 'cyan';
}

export interface SystemPreview {
  id: string;
  name: string;
  vendor: string | null;
  model: string | null;
  riskCategory: string;
  lifecycleStage: string;
  nextReviewAt: string | null;
}

export interface FrameworkCoverage {
  id: string;
  name: string;
  coverage: number; // 0-100
}

/** Governance snapshot backing the AAA dashboard (inventory / compliance / maturity). */
export interface GovernanceSnapshot {
  inventory: { total: number; high: number; overdue: number };
  deltas: { systems7d: number; high7d: number };
  systemsTrend: number[]; // cumulative registered systems, last 7 days
  highTrend: number[];
  overdueTrend: number[];
  systems: SystemPreview[]; // top of the register, for the dashboard preview table
  frameworks: FrameworkCoverage[]; // NIST first — catalog order
  averageCoverage: number;
  maturityScore: number;
  auditEventsToday: number;
}

export interface DashboardPayload {
  stats: {
    conversations: number;
    messagesAnalyzed: number;
    riskFlags: number;
    plan: string;
  };
  memberSince: string | null;
  onboardingCompleted: boolean;
  occupationalRole: string | null;
  recentConversations: RecentConversation[];
  systemStatus: 'nominal' | 'degraded' | 'offline';
  sessionsLast7Days: number[];
  messagesLast7Days: number[];
  deltas: {
    sessionsPct: number;
    messagesPct: number;
  };
  riskBreakdown: { high: number; medium: number; low: number };
  recentEvents: AuditEvent[];
  frameworkStatus: FrameworkUsage[];
  governance: GovernanceSnapshot;
}

function toneForEvent(event: string): AuditEvent['tone'] {
  if (event === 'error' || event.includes('fail')) return 'error';
  if (event.includes('warn') || event.includes('flag')) return 'warn';
  if (event.includes('success') || event.includes('complete') || event.includes('generated')) return 'success';
  return 'info';
}

function summarize(event: string, category: string): string {
  const parts = [event.replace(/_/g, ' '), category ? `(${category})` : ''].filter(Boolean);
  return parts.join(' ');
}

function bumpFrameworkCounts(counts: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  const norm = key.toUpperCase();
  // Bucket common framework tokens that show up in subType / framework metadata
  if (norm.includes('NIST')) counts.set('NIST AI 1.0', (counts.get('NIST AI 1.0') ?? 0) + 1);
  else if (norm.includes('42001') || norm.includes('ISO')) counts.set('ISO/IEC 42001', (counts.get('ISO/IEC 42001') ?? 0) + 1);
  else if (norm.includes('EU') || norm.includes('AI ACT')) counts.set('EU AI ACT', (counts.get('EU AI ACT') ?? 0) + 1);
  else if (norm.includes('GDPR')) counts.set('GDPR', (counts.get('GDPR') ?? 0) + 1);
}

export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // DB ping to decide system status
  const dbStart = Date.now();
  const dbOk = await prisma.$queryRawUnsafe('SELECT 1').then(() => true).catch(() => false);
  const dbMs = Date.now() - dbStart;

  const [
    conversationCount,
    recentConversations,
    messageStats,
    user,
    riskFlagCount,
    riskBreakdownGroups,
    sessionsRaw,
    messagesRaw,
    recentEventsRaw,
    userArtifacts,
    aiSystems,
    postures,
    maturity,
    auditEventsToday,
  ] = await Promise.all([
    prisma.conversation.count({ where: { userId } }),

    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        messages: {
          where: { riskLevel: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { riskLevel: true },
        },
      },
    }),

    prisma.message.aggregate({
      where: { conversation: { userId } },
      _count: { id: true },
    }),

    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, createdAt: true, name: true, onboardingCompleted: true, occupationalRole: true },
    }),

    prisma.message.count({
      where: { conversation: { userId }, riskLevel: { not: null } },
    }),

    prisma.message.groupBy({
      by: ['riskLevel'],
      where: { conversation: { userId }, riskLevel: { not: null } },
      _count: true,
    }),

    prisma.$queryRawUnsafe<Array<{ day: Date; count: bigint }>>(
      `SELECT DATE_TRUNC('day', c."createdAt") as day, COUNT(*) as count
       FROM "Conversation" c
       WHERE c."userId" = $1 AND c."createdAt" >= $2
       GROUP BY DATE_TRUNC('day', c."createdAt")
       ORDER BY day ASC`,
      userId,
      fourteenDaysAgo,
    ),

    prisma.$queryRawUnsafe<Array<{ day: Date; count: bigint }>>(
      `SELECT DATE_TRUNC('day', m."createdAt") as day, COUNT(*) as count
       FROM "Message" m
       INNER JOIN "Conversation" c ON c.id = m."conversationId"
       WHERE c."userId" = $1 AND m."createdAt" >= $2
       GROUP BY DATE_TRUNC('day', m."createdAt")
       ORDER BY day ASC`,
      userId,
      fourteenDaysAgo,
    ),

    prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, createdAt: true, event: true, category: true },
    }),

    prisma.generatedArtifact.findMany({
      where: { userId },
      select: { subType: true },
    }),

    listAiSystems(userId),
    getAllPostures(userId),
    computeMaturity(userId),
    prisma.auditLogEntry.count({
      where: { actorId: userId, createdAt: { gte: todayStart } },
    }),
  ]);

  // Build sparkline arrays — last 7 and prior 7
  const sessionsLast7Days: number[] = [];
  const sessionsPrev7Days: number[] = [];
  const messagesLast7Days: number[] = [];
  const messagesPrev7Days: number[] = [];
  const sessionByDay = new Map(sessionsRaw.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  const msgByDay = new Map(messagesRaw.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));

  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
    const dStr = d.toISOString().slice(0, 10);
    sessionsLast7Days.push(sessionByDay.get(dStr) ?? 0);
    messagesLast7Days.push(msgByDay.get(dStr) ?? 0);
  }
  for (let i = 13; i >= 7; i--) {
    const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
    const dStr = d.toISOString().slice(0, 10);
    sessionsPrev7Days.push(sessionByDay.get(dStr) ?? 0);
    messagesPrev7Days.push(msgByDay.get(dStr) ?? 0);
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const pctDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  // Risk breakdown
  const riskBreakdown = { high: 0, medium: 0, low: 0 };
  for (const g of riskBreakdownGroups) {
    const level = (g.riskLevel ?? '').toLowerCase();
    if (level === 'high' || level === 'critical') riskBreakdown.high += g._count;
    else if (level === 'medium' || level === 'moderate') riskBreakdown.medium += g._count;
    else riskBreakdown.low += g._count;
  }

  // Framework usage from the user's artifacts' subType field
  const frameworkCounts = new Map<string, number>();
  for (const a of userArtifacts) {
    bumpFrameworkCounts(frameworkCounts, a.subType);
  }
  const totalFrameworkHits = [...frameworkCounts.values()].reduce((a, b) => a + b, 0);
  const frameworkStatus: FrameworkUsage[] =
    totalFrameworkHits > 0
      ? [...frameworkCounts.entries()]
          .map(([name, count], idx) => ({
            name,
            count,
            percent: Math.round((count / totalFrameworkHits) * 100),
            tone: (['green', 'amber', 'cyan'] as const)[idx % 3],
          }))
          .sort((a, b) => b.percent - a.percent)
      : [
          { name: 'NIST AI 1.0', percent: 0, count: 0, tone: 'green' },
          { name: 'ISO/IEC 42001', percent: 0, count: 0, tone: 'amber' },
          { name: 'EU AI ACT', percent: 0, count: 0, tone: 'cyan' },
        ];

  const recentEvents: AuditEvent[] = recentEventsRaw.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    event: e.event,
    category: e.category,
    tone: toneForEvent(e.event),
    summary: summarize(e.event, e.category),
  }));

  // Governance snapshot — real inventory / compliance / maturity numbers.
  // Trends are reconstructed from current records (createdAt / nextReviewAt),
  // one point per day for the last 7 days.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dayEnds = Array.from({ length: 7 }, (_, i) =>
    new Date(todayStart.getTime() - (6 - i - 1) * 24 * 60 * 60 * 1000),
  );
  const systemsTrend = dayEnds.map(
    (end) => aiSystems.filter((s) => s.createdAt < end).length,
  );
  const highTrend = dayEnds.map(
    (end) => aiSystems.filter((s) => s.riskCategory === 'high' && s.createdAt < end).length,
  );
  const overdueTrend = dayEnds.map(
    (end) => aiSystems.filter((s) => s.nextReviewAt && s.nextReviewAt < end).length,
  );

  const highCount = aiSystems.filter((s) => s.riskCategory === 'high').length;
  const overdueCount = aiSystems.filter((s) => s.nextReviewAt && s.nextReviewAt < now).length;
  const frameworks: FrameworkCoverage[] = postures.map((p) => ({
    id: p.id,
    name: p.name,
    coverage: p.coverage,
  }));
  const averageCoverage = frameworks.length
    ? Math.round(frameworks.reduce((sum, f) => sum + f.coverage, 0) / frameworks.length)
    : 0;

  const governance: GovernanceSnapshot = {
    inventory: { total: aiSystems.length, high: highCount, overdue: overdueCount },
    deltas: {
      systems7d: aiSystems.filter((s) => s.createdAt >= sevenDaysAgo).length,
      high7d: aiSystems.filter((s) => s.riskCategory === 'high' && s.createdAt >= sevenDaysAgo).length,
    },
    systemsTrend,
    highTrend,
    overdueTrend,
    systems: aiSystems.slice(0, 6).map((s) => ({
      id: s.id,
      name: s.name,
      vendor: s.vendor,
      model: s.model,
      riskCategory: s.riskCategory,
      lifecycleStage: s.lifecycleStage,
      nextReviewAt: s.nextReviewAt?.toISOString() ?? null,
    })),
    frameworks,
    averageCoverage,
    maturityScore: maturity.score,
    auditEventsToday,
  };

  const systemStatus: DashboardPayload['systemStatus'] = !dbOk
    ? 'offline'
    : dbMs > 400
    ? 'degraded'
    : 'nominal';

  const payload: DashboardPayload = {
    stats: {
      conversations: conversationCount,
      messagesAnalyzed: messageStats._count.id,
      riskFlags: riskFlagCount,
      plan: user?.role ?? 'FREE',
    },
    memberSince: user?.createdAt?.toISOString() ?? null,
    onboardingCompleted: user?.onboardingCompleted ?? false,
    occupationalRole: user?.occupationalRole ?? null,
    recentConversations: recentConversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
      riskLevel: c.messages[0]?.riskLevel ?? null,
    })),
    systemStatus,
    sessionsLast7Days,
    messagesLast7Days,
    deltas: {
      sessionsPct: pctDelta(sum(sessionsLast7Days), sum(sessionsPrev7Days)),
      messagesPct: pctDelta(sum(messagesLast7Days), sum(messagesPrev7Days)),
    },
    riskBreakdown,
    recentEvents,
    frameworkStatus,
    governance,
  };

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}