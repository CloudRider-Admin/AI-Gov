/**
 * Full-text conversation search using PostgreSQL tsvector.
 *
 * Searches across conversation titles and message content using GIN indexes.
 * Falls back to ILIKE if FTS fails (e.g., unsupported language config).
 */

import { prisma } from '@/lib/prisma';

export interface SearchResult {
  conversationId: string;
  title: string;
  updatedAt: Date;
  messageCount: number;
  /** Snippet of the matching message content (first match) */
  snippet?: string;
  /** Relevance rank (higher = more relevant) */
  rank: number;
}

interface SearchOptions {
  userId: string;
  query: string;
  limit?: number;
  offset?: number;
}

/**
 * Search conversations by title and message content using PostgreSQL FTS.
 */
export async function searchConversations({
  userId,
  query,
  limit = 20,
  offset = 0,
}: SearchOptions): Promise<{ results: SearchResult[]; total: number }> {
  if (!query.trim()) {
    return { results: [], total: 0 };
  }

  // Convert user query to tsquery format: "ai governance" → "ai & governance"
  const tsQuery = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .join(' & ');

  if (!tsQuery) {
    return { results: [], total: 0 };
  }

  try {
    // FTS query across conversations and messages
    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      updatedAt: Date;
      messageCount: bigint;
      snippet: string | null;
      rank: number;
    }>>(
      `
      SELECT
        c."id",
        c."title",
        c."updatedAt",
        (SELECT COUNT(*) FROM "Message" m2 WHERE m2."conversationId" = c."id") AS "messageCount",
        (
          SELECT LEFT(m3."content", 200)
          FROM "Message" m3
          WHERE m3."conversationId" = c."id"
            AND to_tsvector('english', m3."content") @@ to_tsquery('english', $2)
          ORDER BY ts_rank(to_tsvector('english', m3."content"), to_tsquery('english', $2)) DESC
          LIMIT 1
        ) AS "snippet",
        GREATEST(
          COALESCE(ts_rank(to_tsvector('english', c."title"), to_tsquery('english', $2)), 0),
          COALESCE((
            SELECT MAX(ts_rank(to_tsvector('english', m4."content"), to_tsquery('english', $2)))
            FROM "Message" m4
            WHERE m4."conversationId" = c."id"
          ), 0)
        ) AS "rank"
      FROM "Conversation" c
      WHERE c."userId" = $1
        AND (
          to_tsvector('english', c."title") @@ to_tsquery('english', $2)
          OR EXISTS (
            SELECT 1 FROM "Message" m
            WHERE m."conversationId" = c."id"
              AND to_tsvector('english', m."content") @@ to_tsquery('english', $2)
          )
        )
      ORDER BY "rank" DESC, c."updatedAt" DESC
      LIMIT $3 OFFSET $4
      `,
      userId,
      tsQuery,
      limit,
      offset,
    );

    // Count total matches
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `
      SELECT COUNT(*) as count
      FROM "Conversation" c
      WHERE c."userId" = $1
        AND (
          to_tsvector('english', c."title") @@ to_tsquery('english', $2)
          OR EXISTS (
            SELECT 1 FROM "Message" m
            WHERE m."conversationId" = c."id"
              AND to_tsvector('english', m."content") @@ to_tsquery('english', $2)
          )
        )
      `,
      userId,
      tsQuery,
    );

    return {
      results: results.map((r: { id: string; title: string; updatedAt: Date; messageCount: bigint; snippet: string | null; rank: number }) => ({
        conversationId: r.id,
        title: r.title,
        updatedAt: r.updatedAt,
        messageCount: Number(r.messageCount),
        snippet: r.snippet ?? undefined,
        rank: r.rank,
      })),
      total: Number(countResult[0]?.count ?? 0),
    };
  } catch (err) {
    console.error('[conversationSearch] FTS failed, falling back to ILIKE:', err);
    return fallbackSearch({ userId, query, limit, offset });
  }
}

/**
 * Fallback search using ILIKE when FTS is unavailable.
 */
async function fallbackSearch({
  userId,
  query,
  limit = 20,
  offset = 0,
}: SearchOptions): Promise<{ results: SearchResult[]; total: number }> {
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { messages: { some: { content: { contains: query, mode: 'insensitive' } } } },
      ],
    },
    include: {
      _count: { select: { messages: true } },
      messages: {
        where: { content: { contains: query, mode: 'insensitive' } },
        take: 1,
        select: { content: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.conversation.count({
    where: {
      userId,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { messages: { some: { content: { contains: query, mode: 'insensitive' } } } },
      ],
    },
  });

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: conversations.map((c: Record<string, any>) => ({
      conversationId: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      snippet: c.messages[0]?.content?.slice(0, 200),
      rank: 1,
    })),
    total,
  };
}