import { NextRequest, NextResponse } from 'next/server';

import { getOptionalSession } from '@/lib/auth-guard';
import { workflowOrchestrator } from '@/lib/ai/workflowOrchestrator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await workflowOrchestrator.pauseSession(id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to pause', details: message }, { status: 400 });
  }
}
