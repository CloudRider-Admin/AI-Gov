import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [conversationCount, recentConversations, messageStats, user] = await Promise.all([
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
  ]);

  const riskFlagCount = await prisma.message.count({
    where: {
      conversation: { userId },
      riskLevel: { not: null },
    },
  });

  return NextResponse.json({
    stats: {
      conversations: conversationCount,
      messagesAnalyzed: messageStats._count.id,
      riskFlags: riskFlagCount,
      plan: user?.role ?? 'FREE',
    },
    memberSince: user?.createdAt?.toISOString() ?? null,
    onboardingCompleted: user?.onboardingCompleted ?? false,
    recentConversations: recentConversations.map((c: { id: string; title: string; updatedAt: Date; _count: { messages: number } }) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
    })),
  });
}
