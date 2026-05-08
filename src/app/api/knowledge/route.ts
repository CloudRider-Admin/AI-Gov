import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';
import { generateAndStoreKnowledgeEmbedding } from '@/lib/knowledge/embeddings';

const createSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  category: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  source: z.string().max(200).optional(),
  sourceType: z.enum(['manual', 'sector', 'regulation', 'nist', 'static']).default('manual'),
});

// GET /api/knowledge — admin-only list of active entries (supports ?sourceType= filter)
export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sourceType = request.nextUrl.searchParams.get('sourceType');

  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      isActive: true,
      ...(sourceType ? { sourceType } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      category: true,
      tags: true,
      source: true,
      sourceType: true,
      embeddedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(entries);
}

// POST /api/knowledge — create a new entry (ADMIN only)
// Auto-triggers embedding generation (fire-and-forget)
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const entry = await prisma.knowledgeEntry.create({ data: parsed.data });

  // Fire-and-forget: generate embedding for the new entry
  generateAndStoreKnowledgeEmbedding(entry.id, parsed.data.title, parsed.data.content, parsed.data.tags).catch((err) =>
    console.warn('[knowledge/POST] Auto-embed failed:', err instanceof Error ? err.message : err),
  );

  return NextResponse.json(entry, { status: 201 });
}
