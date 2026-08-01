/**
 * Gate 2 — Evaluation & Review.
 *
 * Collects evaluation results from data science / engineering / red-team
 * (curated from the AI platform in use) as EvaluationEvidence rows, then
 * reviews the collected evidence against the CORE_EVALUATION_PARAMETERS
 * baselines and produces an EvidenceReport with a per-area finding and an
 * overall pass / conditional-pass / fail verdict.
 */

import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { getAiSystem } from './aiSystems';
import {
  EVALUATION_SOURCES,
  type EvaluationSource,
  type ReportVerdict,
} from './governanceEnums';
import {
  CORE_EVALUATION_PARAMETERS,
  CORE_EVALUATION_PARAMETER_IDS,
} from '@/data/coreEvaluationParameters';

export { EVALUATION_SOURCES, CORE_EVALUATION_PARAMETER_IDS };

export interface EvidenceInput {
  reviewArea: string; // CORE_EVALUATION_PARAMETERS id
  source?: EvaluationSource;
  metric?: string | null;
  result: string;
  meetsBaseline?: boolean | null;
  notes?: string | null;
  evaluatedAt?: string | null;
}

/** Per-review-area outcome recorded on the report's areaFindings JSON. */
export type AreaStatus = 'meets-baseline' | 'below-baseline' | 'inconclusive' | 'not-evaluated';

export interface AreaFinding {
  id: string;
  reviewArea: string;
  baseline: string;
  critical: boolean;
  status: AreaStatus;
  evidenceCount: number;
}

export async function listEvidence(userId: string, aiSystemId: string) {
  const system = await getAiSystem(userId, aiSystemId);
  if (!system) return null;
  return prisma.evaluationEvidence.findMany({
    where: { aiSystemId },
    orderBy: [{ reviewArea: 'asc' }, { evaluatedAt: 'desc' }],
  });
}

export async function addEvidence(userId: string, aiSystemId: string, input: EvidenceInput) {
  const system = await getAiSystem(userId, aiSystemId);
  if (!system) return null;

  const evaluatedAt = input.evaluatedAt ? new Date(input.evaluatedAt) : new Date();
  const evidence = await prisma.evaluationEvidence.create({
    data: {
      userId,
      aiSystemId,
      reviewArea: input.reviewArea,
      source: input.source ?? 'data-science',
      metric: input.metric ?? null,
      result: input.result.trim(),
      meetsBaseline: input.meetsBaseline ?? null,
      notes: input.notes ?? null,
      evaluatedAt: Number.isNaN(evaluatedAt.getTime()) ? new Date() : evaluatedAt,
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'evaluation_evidence.added',
    entityType: 'ai_system',
    entityId: aiSystemId,
    summary: `Recorded ${evidence.source} evaluation evidence for "${system.name}" — ${evidence.reviewArea}`,
  });

  return evidence;
}

export async function deleteEvidence(userId: string, aiSystemId: string, evidenceId: string) {
  const system = await getAiSystem(userId, aiSystemId);
  if (!system) return null;
  const evidence = await prisma.evaluationEvidence.findUnique({ where: { id: evidenceId } });
  if (!evidence || evidence.aiSystemId !== aiSystemId) return null;

  await prisma.evaluationEvidence.delete({ where: { id: evidenceId } });
  writeAuditLog({
    actorId: userId,
    action: 'evaluation_evidence.removed',
    entityType: 'ai_system',
    entityId: aiSystemId,
    summary: `Removed evaluation evidence (${evidence.reviewArea}) from "${system.name}"`,
  });
  return true;
}

export async function listReports(userId: string, aiSystemId: string) {
  const system = await getAiSystem(userId, aiSystemId);
  if (!system) return null;
  return prisma.evidenceReport.findMany({
    where: { aiSystemId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}

/**
 * Review the collected evidence against the Core Evaluation Parameters and
 * create an evidence report.
 *
 * Per area: below-baseline if any evidence is marked as failing the baseline;
 * meets-baseline if at least one piece passes and none fail; inconclusive if
 * evidence exists but none has been judged; not-evaluated otherwise.
 *
 * Verdict: fail if a critical area (Safety, Security, Privacy, Agent behavior)
 * is below baseline; conditional-pass when non-critical areas fail or coverage
 * is incomplete; pass when every area has evidence that meets its baseline.
 */
export async function generateEvidenceReport(
  userId: string,
  aiSystemId: string,
  generatedBy: string,
) {
  const system = await getAiSystem(userId, aiSystemId);
  if (!system) return null;

  const evidence = await prisma.evaluationEvidence.findMany({ where: { aiSystemId } });

  const areaFindings: AreaFinding[] = CORE_EVALUATION_PARAMETERS.map((param) => {
    const areaEvidence = evidence.filter((e) => e.reviewArea === param.id);
    let status: AreaStatus;
    if (areaEvidence.length === 0) status = 'not-evaluated';
    else if (areaEvidence.some((e) => e.meetsBaseline === false)) status = 'below-baseline';
    else if (areaEvidence.some((e) => e.meetsBaseline === true)) status = 'meets-baseline';
    else status = 'inconclusive';
    return {
      id: param.id,
      reviewArea: param.reviewArea,
      baseline: param.baseline,
      critical: param.critical,
      status,
      evidenceCount: areaEvidence.length,
    };
  });

  const failing = areaFindings.filter((a) => a.status === 'below-baseline');
  const criticalFailing = failing.filter((a) => a.critical);
  const unevaluated = areaFindings.filter(
    (a) => a.status === 'not-evaluated' || a.status === 'inconclusive',
  );

  let verdict: ReportVerdict;
  if (criticalFailing.length > 0) verdict = 'fail';
  else if (failing.length > 0 || unevaluated.length > 0) verdict = 'conditional-pass';
  else verdict = 'pass';

  const summaryParts = [
    `Evidence report for "${system.name}" (${system.entityType}, ${system.riskCategory} risk): ${evidence.length} evaluation result(s) reviewed against the Core Evaluation Parameters.`,
    `${areaFindings.filter((a) => a.status === 'meets-baseline').length}/${areaFindings.length} review areas meet their governance baseline.`,
  ];
  if (criticalFailing.length > 0) {
    summaryParts.push(
      `Critical areas below baseline: ${criticalFailing.map((a) => a.reviewArea).join(', ')}. Remediation required before Gate 3 approval.`,
    );
  } else if (failing.length > 0) {
    summaryParts.push(`Below baseline: ${failing.map((a) => a.reviewArea).join(', ')}.`);
  }
  if (unevaluated.length > 0) {
    summaryParts.push(
      `Not yet evaluated or inconclusive: ${unevaluated.map((a) => a.reviewArea).join(', ')}.`,
    );
  }
  if (verdict === 'pass') {
    summaryParts.push('All Core Evaluation Parameters satisfied; ready for Gate 3 approval.');
  }

  const report = await prisma.evidenceReport.create({
    data: {
      userId,
      aiSystemId,
      verdict,
      summary: summaryParts.join(' '),
      areaFindings: areaFindings as unknown as object,
      evidenceCount: evidence.length,
      generatedBy,
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'evidence_report.generated',
    entityType: 'ai_system',
    entityId: aiSystemId,
    summary: `Generated Gate 2 evidence report for "${system.name}" — verdict: ${verdict}`,
  });

  return report;
}
