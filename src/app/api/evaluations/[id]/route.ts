import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { deleteEvaluationRun, getEvaluationRun, scoreStoredRun } from '@/lib/gates/evaluations';

/** GET /api/evaluations/:id — a run, its results, and a live re-score. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const run = await getEvaluationRun(session.user.id, id);
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const scored = await scoreStoredRun(session.user.id, id);
  return NextResponse.json({ run, score: scored?.score ?? null });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const run = await deleteEvaluationRun(session.user.id, id);
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
