import { prisma } from '@/lib/prisma';

/**
 * Generate and store a pgvector embedding for one KnowledgeEntry.
 *
 * Prisma does not support the vector column type directly, so the final update
 * stays raw SQL with bound parameters. Callers intentionally fire-and-forget
 * this after successful writes so content management remains responsive.
 */
export async function generateAndStoreKnowledgeEmbedding(
  id: string,
  title: string,
  content: string,
  tags: string[],
): Promise<void> {
  const { generateEmbedding, buildEmbeddingText } = await import('@/lib/ai/embeddings');
  const text = buildEmbeddingText(title, content, tags);
  const embedding = await generateEmbedding(text);
  const vectorStr = `[${embedding.join(',')}]`;

  await prisma.$executeRawUnsafe(
    `UPDATE "KnowledgeEntry" SET embedding = $1::vector, "embeddedAt" = NOW() WHERE id = $2`,
    vectorStr,
    id,
  );
}

export async function clearKnowledgeEmbedding(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "KnowledgeEntry" SET embedding = NULL, "embeddedAt" = NULL WHERE id = $1`,
    id,
  );
}
