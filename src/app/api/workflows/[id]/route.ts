/**
 * GET /api/workflows/[id]
 *
 * Snapshot of the current workflow state — used by the UI on mount and on
 * browser-refresh resume.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOptionalSession } from '@/lib/auth-guard';
import { workflowOrchestrator } from '@/lib/ai/workflowOrchestrator';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const state = await workflowOrchestrator.getState(id, session.user.id);
  if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const nextStep = await workflowOrchestrator.getNextStep(id, session.user.id);
  return NextResponse.json({ state, nextStep });
}
