/**
 * Conversation persistence helpers.
 *
 * Extracted from the advisor route to enable reuse across endpoints.
 */

import { prisma } from '@/lib/prisma';

/**
 * Ensure a conversation exists for the given user.
 * If conversationId is provided and valid, touches updatedAt.
 * Otherwise, creates a new conversation with the query as title.
 */
export async function ensureConversation(
  userId: string,
  query: string,
  conversationId?: string,
): Promise<string> {
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });

    if (existing) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return conversationId;
    }
  }

  const title = query.slice(0, 60) + (query.length > 60 ? '…' : '');
  const conv = await prisma.conversation.create({
    data: { userId, title },
  });
  return conv.id;
}

/**
 * Persist a user query and assistant response as messages in a conversation.
 */
export async function persistMessages(
  conversationId: string,
  query: string,
  responseJson: string,
  riskLevel?: string,
  confidence?: number,
): Promise<void> {
  await prisma.message.createMany({
    data: [
      {
        conversationId,
        role: 'user',
        content: query,
      },
      {
        conversationId,
        role: 'assistant',
        content: responseJson,
        riskLevel,
        confidence,
      },
    ],
  });
}
