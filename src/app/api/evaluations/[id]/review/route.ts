import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkTokenBudget } from '@/lib/tokenBudget';
import { reviewEvaluationRun } from '@/lib/gates/evidenceReview';
import { getEvaluationRun } from '@/lib/gates/evaluations';

/**
 * POST /api/evaluations/:id/review
 *
 * Gate 2's decision point: Govi reviews the ingested evidence against the core
 * evaluation parameters and writes the evidence report.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role ?? 'FREE';
  const rateCheck = await checkRateLimit(session.user.id, '/api/evaluations/review', role);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  const budget = await checkTokenBudget(session.user.id, role);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: 'Monthly token budget exceeded. Upgrade your plan for more capacity.' },
      { status: 429 },
    );
  }

  const { id } = await params;
  const run = await getEvaluationRun(session.user.id, id);
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.results.length === 0) {
    return NextResponse.json(
      { error: 'Attach evaluation evidence to this run before requesting a review.' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const createTasks = body?.createTasks !== false;

  try {
    const result = await reviewEvaluationRun({ userId: session.user.id, runId: id, createTasks });
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      verdict: result.verdict,
      coverageRatio: result.coverageRatio,
      reportMarkdown: result.reportMarkdown,
      narrative: result.narrative,
      score: {
        areas: result.score.areas,
        blockers: result.score.blockers,
        missingAreas: result.score.missingAreas,
        peakSeverity: result.score.peakSeverity,
      },
      degraded: result.degraded,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[evaluations/review] Error:', message);
    return NextResponse.json({ error: 'Failed to review evaluation evidence' }, { status: 500 });
  }
}
