import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const feedbackSchema = z.object({
  query: z.string().min(1),
  detectedIntent: z.enum(['advisor', 'intake', 'document', 'playbook']),
  /** null = user confirmed the detection was correct */
  correctedIntent: z.enum(['advisor', 'intake', 'document', 'playbook']).nullable(),
  documentType: z.string().optional(),
  framework: z.string().optional(),
});

/**
 * POST /api/advisor/intent-feedback
 * Record user confirmation or correction of detected intent.
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid feedback', details: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.intentFeedback.create({
      data: {
        userId: session.user.id,
        query: parsed.data.query,
        detectedIntent: parsed.data.detectedIntent,
        correctedIntent: parsed.data.correctedIntent,
        documentType: parsed.data.documentType ?? null,
        framework: parsed.data.framework ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/advisor/intent-feedback/stats
 * Returns intent correction statistics (admin use).
 */
export async function GET() {
  const session = await getOptionalSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [total, corrections, byIntent] = await Promise.all([
    prisma.intentFeedback.count(),
    prisma.intentFeedback.count({ where: { correctedIntent: { not: null } } }),
    prisma.intentFeedback.groupBy({
      by: ['detectedIntent', 'correctedIntent'],
      _count: true,
      orderBy: { _count: { detectedIntent: 'desc' } },
    }),
  ]);

  return NextResponse.json({
    total,
    corrections,
    accuracy: total > 0 ? ((total - corrections) / total * 100).toFixed(1) + '%' : 'N/A',
    breakdown: byIntent,
  });
}