/**
 * Gate 2 — evaluation run persistence.
 *
 * Owns the lifecycle of an evaluation run: created (draft) → evidence attached
 * (ingested) → reviewed against the core evaluation parameters (reviewed).
 * Every transition refreshes the gate board and writes to the audit trail.
 */

import { prisma } from '../prisma';
import { writeAuditLog } from '../audit';
import { refreshGates } from './gates';
import { scoreRun, type ScoreableResult, type ScoringContext } from './baselineScoring';
import { getAreaSpec, type AreaBaseline, type EvaluationArea } from './coreEvaluationParameters';
import type { NormalizedResult } from './evidenceIngestion';

export interface EvaluationRunInput {
  aiSystemId: string;
  runLabel: string;
  source?: 'upload' | 'manual' | 'api';
  sourceRef?: string | null;
  evaluatorTeam?: string | null;
  evaluatorName?: string | null;
  platform?: string | null;
  evaluatedAt?: string | Date | null;
}

function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Confirms the entity belongs to the caller before any run is touched. */
export async function assertOwnedSystem(userId: string, aiSystemId: string) {
  const system = await prisma.aiSystem.findUnique({
    where: { id: aiSystemId },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      name: true,
      entityKind: true,
      riskCategory: true,
      purpose: true,
      description: true,
    },
  });
  if (!system || system.userId !== userId) return null;
  return system;
}

export async function listEvaluationRuns(userId: string, aiSystemId: string) {
  const system = await assertOwnedSystem(userId, aiSystemId);
  if (!system) return null;

  return prisma.evaluationRun.findMany({
    where: { aiSystemId },
    orderBy: { createdAt: 'desc' },
    include: { results: { orderBy: [{ area: 'asc' }, { parameter: 'asc' }] } },
  });
}

export async function getEvaluationRun(userId: string, runId: string) {
  const run = await prisma.evaluationRun.findUnique({
    where: { id: runId },
    include: { results: { orderBy: [{ area: 'asc' }, { parameter: 'asc' }] } },
  });
  if (!run || run.userId !== userId) return null;
  return run;
}

export async function createEvaluationRun(userId: string, input: EvaluationRunInput) {
  const system = await assertOwnedSystem(userId, input.aiSystemId);
  if (!system) return null;

  const run = await prisma.evaluationRun.create({
    data: {
      aiSystemId: input.aiSystemId,
      userId,
      organizationId: system.organizationId,
      runLabel: input.runLabel.trim(),
      source: input.source ?? 'manual',
      sourceRef: input.sourceRef ?? null,
      evaluatorTeam: input.evaluatorTeam ?? null,
      evaluatorName: input.evaluatorName ?? null,
      platform: input.platform ?? null,
      evaluatedAt: parseDate(input.evaluatedAt),
      status: 'draft',
    },
  });

  await writeAuditLog({
    actorId: userId,
    organizationId: system.organizationId,
    action: 'evaluation.run_created',
    entityType: 'evaluation_run',
    entityId: run.id,
    summary: `Opened evaluation run "${run.runLabel}" for ${system.entityKind} "${system.name}"`,
    metadata: { aiSystemId: system.id, source: run.source },
  });

  await refreshGates(input.aiSystemId, userId);
  return run;
}

/**
 * Attach normalized evidence to a run. Replaces any results already attached,
 * so re-uploading a corrected export is a clean overwrite rather than a merge
 * that would silently double-count.
 */
export async function attachEvidence(params: {
  userId: string;
  runId: string;
  results: NormalizedResult[];
  rawPayload?: string | null;
}) {
  const run = await prisma.evaluationRun.findUnique({
    where: { id: params.runId },
    select: { id: true, userId: true, aiSystemId: true, runLabel: true, organizationId: true },
  });
  if (!run || run.userId !== params.userId) return null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.evaluationResult.deleteMany({ where: { runId: params.runId } });

    if (params.results.length > 0) {
      await tx.evaluationResult.createMany({
        data: params.results.map((r) => ({
          runId: params.runId,
          area: r.area,
          parameter: r.parameter,
          metricValue: r.metricValue,
          unit: r.unit,
          textValue: r.textValue,
          method: r.method,
          sampleSize: r.sampleSize,
          evidenceUrl: r.evidenceUrl,
        })),
      });
    }

    return tx.evaluationRun.update({
      where: { id: params.runId },
      data: {
        status: params.results.length > 0 ? 'ingested' : 'draft',
        // New evidence invalidates the previous report.
        overallVerdict: null,
        reviewSummary: null,
        reportMarkdown: null,
        reviewedAt: null,
        coverageRatio: null,
        ...(params.rawPayload !== undefined ? { rawPayload: params.rawPayload } : {}),
      },
      include: { results: true },
    });
  });

  await writeAuditLog({
    actorId: params.userId,
    organizationId: run.organizationId,
    action: 'evaluation.evidence_attached',
    entityType: 'evaluation_run',
    entityId: run.id,
    summary: `Attached ${params.results.length} evaluation result(s) to run "${run.runLabel}"`,
    metadata: { resultCount: params.results.length },
  });

  await refreshGates(run.aiSystemId, params.userId);
  return updated;
}

export async function deleteEvaluationRun(userId: string, runId: string) {
  const run = await prisma.evaluationRun.findUnique({
    where: { id: runId },
    select: { id: true, userId: true, aiSystemId: true, runLabel: true, organizationId: true },
  });
  if (!run || run.userId !== userId) return null;

  await prisma.evaluationRun.delete({ where: { id: runId } });

  await writeAuditLog({
    actorId: userId,
    organizationId: run.organizationId,
    action: 'evaluation.run_deleted',
    entityType: 'evaluation_run',
    entityId: run.id,
    summary: `Deleted evaluation run "${run.runLabel}"`,
  });

  await refreshGates(run.aiSystemId, userId);
  return run;
}

/**
 * Load the org's baseline overrides as a lookup the scorer can use. Rows whose
 * `appliesToRisk` excludes this entity's tier are ignored, so an org can hold
 * high-risk systems to a stricter bar without moving the bar for everything.
 */
export async function loadBaselineOverrides(
  userId: string,
  riskCategory: string,
): Promise<Partial<Record<EvaluationArea, AreaBaseline>>> {
  const rows = await prisma.evaluationBaseline.findMany({ where: { userId } });
  const overrides: Partial<Record<EvaluationArea, AreaBaseline>> = {};

  for (const row of rows) {
    const spec = getAreaSpec(row.area);
    if (!spec) continue;
    if (row.appliesToRisk.length > 0 && !row.appliesToRisk.includes(riskCategory)) continue;

    overrides[spec.id] = {
      expectation: row.expectation,
      comparator: row.comparator as AreaBaseline['comparator'],
      threshold: row.threshold ?? undefined,
      unit: (row.unit as AreaBaseline['unit']) ?? undefined,
    };
  }
  return overrides;
}

/** Score a run's stored results without persisting anything — used for previews. */
export async function scoreStoredRun(userId: string, runId: string) {
  const run = await getEvaluationRun(userId, runId);
  if (!run) return null;

  const system = await assertOwnedSystem(userId, run.aiSystemId);
  if (!system) return null;

  const overrides = await loadBaselineOverrides(userId, system.riskCategory);
  const ctx: ScoringContext = {
    riskCategory: system.riskCategory,
    entityKind: system.entityKind,
    overrides,
  };

  const scoreable: ScoreableResult[] = run.results.map((r) => ({
    area: r.area,
    parameter: r.parameter,
    metricValue: r.metricValue,
    unit: r.unit,
    textValue: r.textValue,
    sampleSize: r.sampleSize,
  }));

  return { run, system, score: scoreRun(scoreable, ctx), ctx };
}
