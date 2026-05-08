/**
 * POST /api/workflows/[id]/answer
 *
 * Body: { sectionId: string, answer: unknown }
 *
 * Returns: { state, nextStep, done, warning? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getOptionalSession } from '@/lib/auth-guard';
import { workflowOrchestrator } from '@/lib/ai/workflowOrchestrator';

const bodySchema = z.object({
  sectionId: z.string().min(1),
  answer: z.unknown(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await workflowOrchestrator.submitAnswer(
      id,
      session.user.id,
      parsed.data.sectionId,
      parsed.data.answer,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: 'Failed to submit answer', details: message }, { status });
  }
}
