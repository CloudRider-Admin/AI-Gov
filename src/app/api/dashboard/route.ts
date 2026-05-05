import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';

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

export interface DashboardPayload {
  stats: {
    conversations: number;
    messagesAnalyzed: number;
    riskFlags: number;
    plan: string;
  };
  memberSince: string | null;
  onboardingCompleted: boolean;
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
      select: { role: true, createdAt: true, name: true, onboardingCompleted: true },
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
  ]);

  // Build sparkline arrays — last 7 and prior 7
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
  };

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}