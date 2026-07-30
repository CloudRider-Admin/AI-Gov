import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { createEvaluationRun, listEvaluationRuns } from '@/lib/gates/evaluations';
import { EVALUATOR_TEAMS } from '@/lib/gates/coreEvaluationParameters';

/** GET /api/evaluations?aiSystemId=… — every run recorded against one entity. */
export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const aiSystemId = request.nextUrl.searchParams.get('aiSystemId');
  if (!aiSystemId) {
    return NextResponse.json({ error: 'aiSystemId is required' }, { status: 400 });
  }

  const runs = await listEvaluationRuns(session.user.id, aiSystemId);
  if (runs === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ runs });
}

/** POST /api/evaluations — open a new evaluation run for an entity. */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.aiSystemId !== 'string') {
    return NextResponse.json({ error: 'aiSystemId is required' }, { status: 400 });
  }
  if (typeof body.runLabel !== 'string' || !body.runLabel.trim()) {
    return NextResponse.json({ error: 'A run label is required' }, { status: 400 });
  }
  if (body.evaluatorTeam && !EVALUATOR_TEAMS.includes(body.evaluatorTeam)) {
    return NextResponse.json({ error: 'Invalid evaluator team' }, { status: 400 });
  }

  try {
    const run = await createEvaluationRun(session.user.id, {
      aiSystemId: body.aiSystemId,
      runLabel: body.runLabel,
      source: body.source === 'upload' || body.source === 'api' ? body.source : 'manual',
      sourceRef: body.sourceRef ?? null,
      evaluatorTeam: body.evaluatorTeam ?? null,
      evaluatorName: body.evaluatorName ?? null,
      platform: body.platform ?? null,
      evaluatedAt: body.evaluatedAt ?? null,
    });
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    // The (aiSystemId, runLabel) unique index is the guard against a harness
    // double-posting the same run.
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A run with this label already exists for this entity.' },
        { status: 409 },
      );
    }
    throw err;
  }
}
