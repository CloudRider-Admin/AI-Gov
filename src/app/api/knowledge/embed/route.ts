import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';
import { generateEmbeddings, buildEmbeddingText } from '@/lib/ai/embeddings';

/**
 * POST /api/knowledge/embed
 * Admin-only: generate embeddings for knowledge entries that don't have them yet.
 * Body: { ids?: string[] } — if provided, embed only those entries; otherwise embed all un-embedded.
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const ids: string[] | undefined = body.ids;

    // Fetch entries that need embedding
    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        isActive: true,
        ...(ids?.length ? { id: { in: ids } } : { embeddedAt: null }),
      },
      select: { id: true, title: true, content: true, tags: true },
    });

    if (entries.length === 0) {
      return NextResponse.json({ message: 'No entries to embed', embedded: 0 });
    }

    // Build texts for embedding
    const texts = entries.map((e: { title: string; content: string; tags: string[] }) => buildEmbeddingText(e.title, e.content, e.tags));

    // Generate embeddings in batches
    const embeddings = await generateEmbeddings(texts);

    // Update each entry with its embedding via raw SQL (Prisma doesn't support vector type)
    let embedded = 0;
    for (let i = 0; i < entries.length; i++) {
      const vectorStr = `[${embeddings[i].join(',')}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeEntry" SET embedding = $1::vector, "embeddedAt" = NOW() WHERE id = $2`,
        vectorStr,
        entries[i].id,
      );
      embedded++;
    }

    return NextResponse.json({
      message: `Successfully embedded ${embedded} entries`,
      embedded,
      total: entries.length,
    });
  } catch (error) {
    console.error('[embed] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate embeddings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}