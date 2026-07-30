import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveIngestToken } from '@/lib/gates/ingestTokens';
import { attachEvidence, createEvaluationRun, assertOwnedSystem } from '@/lib/gates/evaluations';
import { parseJsonEvidence } from '@/lib/gates/evidenceIngestion';
import { reviewEvaluationRun } from '@/lib/gates/evidenceReview';
import { EVALUATOR_TEAMS } from '@/lib/gates/coreEvaluationParameters';

/**
 * POST /api/evaluations/ingest
 *
 * Unattended ingestion for eval harnesses and CI pipelines. Authenticated with
 * a bearer token rather than a session, so a nightly red-team run can push its
 * results into Gate 2 without a human present.
 *
 *   Authorization: Bearer gsk_…
 *   {
 *     "aiSystemId": "clx…",
 *     "runLabel": "redteam-2026-07-30",
 *     "evaluatorTeam": "red-team",
 *     "platform": "Azure AI Foundry",
 *     "autoReview": true,
 *     "results": [ { "area": "security", "parameter": "prompt injection ASR", "value": 0 } ]
 *   }
 *
 * Idempotent on (aiSystemId, runLabel): re-posting the same label replaces that
 * run's evidence rather than creating a duplicate, so a retried pipeline step
 * converges instead of accumulating.
 */
export async function POST(request: NextRequest) {
  const auth = await resolveIngestToken(request.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json(
      { error: 'A valid ingestion token is required.' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }

  // Rate limit per token owner, not per IP — a CI runner's IP is shared.
  const rateCheck = await checkRateLimit(`ingest:${auth.userId}`, '/api/evaluations/ingest', 'TEAM');
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const aiSystemId = typeof body.aiSystemId === 'string' ? body.aiSystemId : null;
  const runLabel = typeof body.runLabel === 'string' ? body.runLabel.trim() : '';
  if (!aiSystemId) return NextResponse.json({ error: 'aiSystemId is required' }, { status: 400 });
  if (!runLabel) return NextResponse.json({ error: 'runLabel is required' }, { status: 400 });
  if (body.evaluatorTeam && !EVALUATOR_TEAMS.includes(body.evaluatorTeam)) {
    return NextResponse.json({ error: 'Invalid evaluatorTeam' }, { status: 400 });
  }

  const system = await assertOwnedSystem(auth.userId, aiSystemId);
  if (!system) {
    return NextResponse.json(
      { error: 'No registered entity with that id is available to this token.' },
      { status: 404 },
    );
  }

  const outcome = parseJsonEvidence(body.results ?? body);
  if (outcome.results.length === 0) {
    return NextResponse.json(
      { error: 'No usable evaluation results were found.', warnings: outcome.warnings },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.evaluationRun.findUnique({
      where: { aiSystemId_runLabel: { aiSystemId, runLabel } },
      select: { id: true },
    });

    const runId =
      existing?.id ??
      (
        await createEvaluationRun(auth.userId, {
          aiSystemId,
          runLabel,
          source: 'api',
          sourceRef: typeof body.sourceRef === 'string' ? body.sourceRef : null,
          evaluatorTeam: body.evaluatorTeam ?? null,
          evaluatorName: typeof body.evaluatorName === 'string' ? body.evaluatorName : null,
          platform: typeof body.platform === 'string' ? body.platform : null,
          evaluatedAt: body.evaluatedAt ?? new Date(),
        })
      )?.id;

    if (!runId) return NextResponse.json({ error: 'Failed to open the evaluation run' }, { status: 500 });

    await attachEvidence({
      userId: auth.userId,
      runId,
      results: outcome.results,
      rawPayload: JSON.stringify(body).slice(0, 100_000),
    });

    // Harnesses generally want the verdict in the same call so a pipeline can
    // fail its own build on a governance failure.
    let review = null;
    if (body.autoReview !== false) {
      const result = await reviewEvaluationRun({ userId: auth.userId, runId });
      if (result) {
        review = {
          verdict: result.verdict,
          coverageRatio: result.coverageRatio,
          blockers: result.score.blockers,
          missingAreas: result.score.missingAreas,
        };
      }
    }

    return NextResponse.json(
      {
        runId,
        replaced: Boolean(existing),
        ingested: outcome.results.length,
        unmapped: outcome.unmapped.map((u) => u.label),
        warnings: outcome.warnings,
        review,
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[evaluations/ingest] Error:', message);
    return NextResponse.json({ error: 'Failed to ingest evaluation results' }, { status: 500 });
  }
}
