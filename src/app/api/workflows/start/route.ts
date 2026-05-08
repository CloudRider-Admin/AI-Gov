/**
 * POST /api/workflows/start
 *
 * Begin a new multi-turn workflow session. Returns the new sessionId, the
 * first step, and the initial state so the UI can render the panel without
 * a follow-up GET.
 *
 * Body: { workflowType: WorkflowType, conversationId?: string, context?: Record<string, unknown> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getOptionalSession } from '@/lib/auth-guard';
import { workflowOrchestrator } from '@/lib/ai/workflowOrchestrator';

const bodySchema = z.object({
  // Validate against actually-registered workflows, not the full
  // `WorkflowType` union. `90day-blueprint` and `risk-assessment` are listed
  // in the type definition for forward compatibility but their
  // `WorkflowDefinition`s aren't registered yet — accepting them here would
  // 500 inside `getDefinition()`. This keeps the surface honest.
  workflowType: z.string().refine(
    (v) => workflowOrchestrator.isRegistered(v),
    (v) => ({ message: `Workflow type "${v}" is not currently available. Available: ${workflowOrchestrator.registeredTypes().join(', ')}` }),
  ),
  conversationId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const result = await workflowOrchestrator.startSession({
      userId: session.user.id,
      workflowType: parsed.data.workflowType as Parameters<typeof workflowOrchestrator.startSession>[0]['workflowType'],
      conversationId: parsed.data.conversationId,
      context: parsed.data.context,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to start workflow', details: message }, { status: 500 });
  }
}
