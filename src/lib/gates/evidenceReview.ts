/**
 * Govi's Gate 2 reviewer: turns raw evaluation results into an evidence report.
 *
 * The division of labour matters. The deterministic scorer in baselineScoring
 * decides every verdict — per parameter, per area, and overall — before Govi is
 * called. Govi's job is to explain that verdict: what the evidence shows, where
 * it falls short of the core evaluation parameters, and what has to be
 * remediated. It is explicitly told it cannot overturn a verdict, so a model
 * that is feeling generous cannot talk a failed safety evaluation into an
 * approval.
 *
 * If the LLM is unavailable, the report still gets written — from the scores
 * alone. An evidence report is a compliance artifact; it cannot be contingent
 * on a third-party API being up.
 */

import OpenAI from 'openai';
import { prisma } from '../prisma';
import { writeAuditLog } from '../audit';
import { auditLog } from '../utils/logger';
import { openaiCircuit, CircuitOpenError } from '../circuitBreaker';
import { recordTokenUsage } from '../tokenBudget';
import { claudeComplete, isOpenAIQuotaError, isClaudeFallbackAvailable } from '../ai/claudeFallback';
import { refreshGates } from './gates';
import { scoreStoredRun } from './evaluations';
import { describeBaseline, type AreaRollup, type RunScore } from './baselineScoring';
import { CORE_EVALUATION_PARAMETERS, getAreaSpec, type RunVerdict } from './coreEvaluationParameters';
import { riskSeverity } from './gateEnums';

const REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || 'gpt-4o';

const REVIEWER_SYSTEM_PROMPT = `You are Govi, the evaluation reviewer inside GovSecure, an AI governance platform.

You are given the results of an AI system evaluation carried out by a data science, engineering, or red team, together with a deterministic scoring of those results against GovSecure's CORE EVALUATION PARAMETERS — the baseline standard every model is held to.

Your job is to write the narrative of an evidence report that a compliance officer, an internal auditor, or a regulator will read.

HARD RULES — these are not negotiable:
1. The verdicts you are given are final. Never contradict, soften, or re-argue a verdict. If an area is marked FAIL, write about it as a failure.
2. Never invent a number, a test, a sample size, or a finding. Every figure you cite must appear in the evidence you were given.
3. If an area carries no evidence, say so plainly. Absence of evidence is not evidence of compliance, and you must never write as though it were.
4. Be specific about what is missing and what must change. "Improve safety testing" is useless; "no red-team results were supplied for prompt injection, which is mandatory at this risk tier" is useful.
5. Write in plain professional English. No marketing language, no hedging, no filler.

Respond with a JSON object of exactly this shape:
{
  "executiveSummary": "3-5 sentences: what was evaluated, what the evidence shows, and whether it meets the baseline.",
  "areaNarratives": [
    { "area": "<area id>", "assessment": "2-3 sentences on what the evidence shows for this area against its baseline." }
  ],
  "keyFindings": ["Specific, evidence-backed findings, most material first."],
  "remediationActions": [
    { "title": "Short imperative action", "detail": "What to do and why.", "priority": "low|medium|high|critical", "area": "<area id>" }
  ],
  "residualRisk": "2-3 sentences on what risk remains if this system proceeds as evidenced.",
  "approvalRecommendation": "2-3 sentences addressed to the approver. State clearly whether the evidence supports moving to Gate 3."
}

Include an areaNarrative only for areas that carry evidence or that are flagged as mandatory-but-missing. Do not pad.`;

export interface AreaNarrative {
  area: string;
  assessment: string;
}

export interface RemediationSuggestion {
  title: string;
  detail: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  area?: string;
}

export interface EvidenceNarrative {
  executiveSummary: string;
  areaNarratives: AreaNarrative[];
  keyFindings: string[];
  remediationActions: RemediationSuggestion[];
  residualRisk: string;
  approvalRecommendation: string;
}

export interface EvidenceReportResult {
  runId: string;
  verdict: RunVerdict;
  coverageRatio: number;
  reportMarkdown: string;
  narrative: EvidenceNarrative;
  score: RunScore;
  /** True when the narrative came from the deterministic fallback, not the LLM. */
  degraded: boolean;
}

// ─── Prompt construction ────────────────────────────────────────────────────

function buildEvidenceDigest(score: RunScore, system: { name: string; entityKind: string; riskCategory: string; purpose: string | null }): string {
  const lines: string[] = [];

  lines.push(`ENTITY: ${system.name}`);
  lines.push(`KIND: ${system.entityKind}`);
  lines.push(`RISK TIER: ${system.riskCategory} (${riskSeverity(system.riskCategory)} severity)`);
  if (system.purpose) lines.push(`PURPOSE: ${system.purpose}`);
  lines.push('');
  lines.push(`OVERALL VERDICT (final, set deterministically): ${score.verdict.toUpperCase()}`);
  lines.push(`CORE AREA COVERAGE: ${Math.round(score.coverageRatio * 100)}% (${score.areas.filter((a) => a.resultCount > 0).length} of ${CORE_EVALUATION_PARAMETERS.length} areas)`);
  lines.push('');
  lines.push('EVIDENCE BY REVIEW AREA:');

  for (const area of score.areas) {
    const spec = getAreaSpec(area.area);
    if (!spec) continue;

    if (area.resultCount === 0) {
      lines.push(
        `\n- ${area.label} [${area.missingMandatory ? 'MANDATORY — NO EVIDENCE SUPPLIED' : 'no evidence supplied'}]`,
      );
      lines.push(`  baseline: ${describeBaseline(spec.baseline)}`);
      continue;
    }

    lines.push(`\n- ${area.label} [${area.verdict.toUpperCase()}]`);
    lines.push(`  baseline: ${describeBaseline(spec.baseline)}`);
    for (const result of score.results.filter((r) => r.area === area.area)) {
      const measured =
        result.metricValue !== null && result.metricValue !== undefined
          ? `${result.metricValue}${result.unit ? ` ${result.unit}` : ''}`
          : (result.textValue ?? 'no value');
      lines.push(
        `  • ${result.parameter}: ${measured} → ${result.verdict.toUpperCase()}${
          result.severity !== 'none' ? ` (severity: ${result.severity})` : ''
        }${result.sampleSize ? ` [n=${result.sampleSize}]` : ''}`,
      );
      if (result.gap) lines.push(`    gap: ${result.gap}`);
    }
  }

  if (score.blockers.length > 0) {
    lines.push('\nBLOCKERS IDENTIFIED BY SCORING:');
    for (const blocker of score.blockers) lines.push(`  • ${blocker}`);
  }

  return lines.join('\n');
}

// ─── LLM call ───────────────────────────────────────────────────────────────

function coerceNarrative(raw: unknown): EvidenceNarrative | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];

  const areaNarratives: AreaNarrative[] = Array.isArray(obj.areaNarratives)
    ? obj.areaNarratives
        .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
        .map((n) => ({ area: String(n.area ?? ''), assessment: String(n.assessment ?? '') }))
        .filter((n) => n.area && n.assessment)
    : [];

  const priorities = new Set(['low', 'medium', 'high', 'critical']);
  const remediationActions: RemediationSuggestion[] = Array.isArray(obj.remediationActions)
    ? obj.remediationActions
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map((a) => ({
          title: String(a.title ?? '').trim(),
          detail: String(a.detail ?? '').trim(),
          priority: priorities.has(String(a.priority)) ? (String(a.priority) as RemediationSuggestion['priority']) : 'medium',
          area: a.area ? String(a.area) : undefined,
        }))
        .filter((a) => a.title)
    : [];

  const executiveSummary = typeof obj.executiveSummary === 'string' ? obj.executiveSummary.trim() : '';
  if (!executiveSummary) return null;

  return {
    executiveSummary,
    areaNarratives,
    keyFindings: asStringArray(obj.keyFindings),
    remediationActions,
    residualRisk: typeof obj.residualRisk === 'string' ? obj.residualRisk.trim() : '',
    approvalRecommendation:
      typeof obj.approvalRecommendation === 'string' ? obj.approvalRecommendation.trim() : '',
  };
}

async function generateNarrative(
  digest: string,
  userId: string,
): Promise<{ narrative: EvidenceNarrative | null; degraded: boolean }> {
  if (!process.env.OPENAI_API_KEY && !isClaudeFallbackAvailable()) {
    return { narrative: null, degraded: true };
  }

  const userMessage = `${digest}\n\nWrite the evidence report narrative as the specified JSON object.`;

  // ── OpenAI, behind the shared circuit breaker ──
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openaiCircuit.execute(() =>
        openai.chat.completions.create({
          model: REVIEW_MODEL,
          messages: [
            { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          // Low temperature: this is a compliance artifact, not a creative one.
          temperature: 0.2,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
      );

      recordTokenUsage({
        userId,
        endpoint: 'gate2-review',
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        model: REVIEW_MODEL,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const narrative = coerceNarrative(JSON.parse(content));
        if (narrative) return { narrative, degraded: false };
      }
    } catch (err) {
      const shouldFallback =
        (isOpenAIQuotaError(err) || err instanceof CircuitOpenError) && isClaudeFallbackAvailable();
      auditLog({
        event: shouldFallback ? 'fallback.claude' : 'orchestrator.error',
        data: {
          reason: 'gate2_review_openai_failed',
          error: err instanceof Error ? err.message : String(err),
        },
      });
      if (!shouldFallback) return { narrative: null, degraded: true };
    }
  }

  // ── Claude fallback ──
  if (isClaudeFallbackAvailable()) {
    try {
      const result = await claudeComplete({
        system: REVIEWER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.2,
        maxTokens: 3000,
        jsonOnly: true,
      });

      recordTokenUsage({
        userId,
        endpoint: 'gate2-review',
        promptTokens: result.usage.input_tokens,
        completionTokens: result.usage.output_tokens,
        model: result.model,
      });

      const narrative = coerceNarrative(JSON.parse(result.content));
      if (narrative) return { narrative, degraded: false };
    } catch (err) {
      auditLog({
        event: 'orchestrator.error',
        data: {
          reason: 'gate2_review_claude_failed',
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return { narrative: null, degraded: true };
}

/**
 * Build a narrative from the scores alone. Terser than the LLM's, and entirely
 * factual — it only restates what the scorer already established.
 */
function buildDeterministicNarrative(score: RunScore, systemName: string): EvidenceNarrative {
  const covered = score.areas.filter((a) => a.resultCount > 0);
  const failing = score.areas.filter((a) => a.verdict === 'fail');
  const missing = score.areas.filter((a) => a.missingMandatory);

  const verdictSentence =
    score.verdict === 'pass'
      ? 'The evidence supplied meets the core evaluation baselines.'
      : score.verdict === 'conditional-pass'
        ? 'The evidence supplied meets the core evaluation baselines in the areas assessed, with gaps that require remediation.'
        : 'The evidence supplied does not meet the core evaluation baselines.';

  const keyFindings: string[] = [];
  for (const area of failing) {
    for (const failure of area.failures) {
      keyFindings.push(`${area.label} — ${failure.parameter}: ${failure.gap ?? 'baseline not met'}`);
    }
  }
  for (const area of missing) {
    keyFindings.push(`${area.label}: mandatory at this risk tier, but no evidence was supplied.`);
  }

  const remediationActions: RemediationSuggestion[] = [
    ...failing.flatMap((area) =>
      area.failures.map((failure) => ({
        title: `Close the ${area.label.toLowerCase()} gap on ${failure.parameter}`,
        detail: failure.gap ?? `Bring ${failure.parameter} within the baseline: ${failure.baselineNote}`,
        priority: (failure.severity === 'critical'
          ? 'critical'
          : failure.severity === 'high'
            ? 'high'
            : 'medium') as RemediationSuggestion['priority'],
        area: area.area,
      })),
    ),
    ...missing.map((area) => ({
      title: `Evaluate ${area.label.toLowerCase()}`,
      detail: `${area.label} is mandatory at this risk tier and carries no evidence. Run the evaluation and re-submit.`,
      priority: 'high' as const,
      area: area.area,
    })),
  ];

  return {
    executiveSummary: `${systemName} was evaluated across ${covered.length} of ${CORE_EVALUATION_PARAMETERS.length} core review areas. ${verdictSentence} ${
      failing.length > 0 ? `${failing.length} area(s) failed their baseline. ` : ''
    }${missing.length > 0 ? `${missing.length} mandatory area(s) carry no evidence. ` : ''}This narrative was generated from the scored evidence without model assistance.`,
    areaNarratives: covered.map((area) => ({
      area: area.area,
      assessment: `${area.label}: ${area.verdict.toUpperCase()} across ${area.resultCount} measured parameter(s)${
        area.failures.length > 0 ? `, with ${area.failures.length} falling short of the baseline` : ''
      }.`,
    })),
    keyFindings,
    remediationActions,
    residualRisk:
      score.verdict === 'pass'
        ? 'No residual risk was identified beyond the areas assessed. Areas without evidence remain unquantified.'
        : 'Residual risk is concentrated in the failing and unevaluated areas listed above and is unquantified until they are addressed.',
    approvalRecommendation:
      score.verdict === 'fail'
        ? 'The evidence does not support progressing to approval. Remediate the blocking findings and re-evaluate.'
        : score.verdict === 'conditional-pass'
          ? 'The evidence supports progressing to approval once the listed remediation is complete.'
          : 'The evidence supports progressing to approval.',
  };
}

// ─── Report rendering ───────────────────────────────────────────────────────

function verdictBadge(verdict: RunVerdict): string {
  return verdict === 'pass' ? 'PASS' : verdict === 'conditional-pass' ? 'CONDITIONAL PASS' : 'FAIL';
}

function renderAreaTable(score: RunScore): string {
  const rows = score.areas.map((area: AreaRollup) => {
    const spec = getAreaSpec(area.area);
    const status =
      area.resultCount === 0
        ? area.missingMandatory
          ? 'NO EVIDENCE (mandatory)'
          : 'No evidence'
        : area.verdict.toUpperCase();
    const baseline = spec ? describeBaseline(spec.baseline).replace(/\|/g, '\\|') : '—';
    return `| ${area.label} | ${area.resultCount} | ${status} | ${baseline} |`;
  });

  return [
    '| Review area | Results | Verdict | Governance baseline |',
    '| --- | ---: | --- | --- |',
    ...rows,
  ].join('\n');
}

export function renderEvidenceReport(params: {
  systemName: string;
  entityKind: string;
  riskCategory: string;
  runLabel: string;
  evaluatorTeam: string | null;
  evaluatorName: string | null;
  platform: string | null;
  evaluatedAt: Date | null;
  score: RunScore;
  narrative: EvidenceNarrative;
  degraded: boolean;
}): string {
  const { score, narrative } = params;
  const lines: string[] = [];

  lines.push(`# Evidence Report — ${params.systemName}`);
  lines.push('');
  lines.push(`**Gate 2 — Evaluation & Review**`);
  lines.push('');
  lines.push(`| | |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Entity | ${params.systemName} (${params.entityKind}) |`);
  lines.push(`| Risk tier | ${params.riskCategory} (${riskSeverity(params.riskCategory)} severity) |`);
  lines.push(`| Evaluation run | ${params.runLabel} |`);
  if (params.evaluatorTeam) lines.push(`| Evaluated by | ${params.evaluatorTeam}${params.evaluatorName ? ` — ${params.evaluatorName}` : ''} |`);
  if (params.platform) lines.push(`| Platform | ${params.platform} |`);
  if (params.evaluatedAt) lines.push(`| Evaluation date | ${params.evaluatedAt.toISOString().slice(0, 10)} |`);
  lines.push(`| Reviewed | ${new Date().toISOString().slice(0, 10)} by Govi |`);
  lines.push(`| **Overall verdict** | **${verdictBadge(score.verdict)}** |`);
  lines.push(`| Core area coverage | ${Math.round(score.coverageRatio * 100)}% |`);
  lines.push('');

  lines.push('## Executive summary');
  lines.push('');
  lines.push(narrative.executiveSummary);
  lines.push('');

  lines.push('## Results against the core evaluation parameters');
  lines.push('');
  lines.push(renderAreaTable(score));
  lines.push('');

  const narrated = narrative.areaNarratives.filter((n) => getAreaSpec(n.area));
  if (narrated.length > 0) {
    lines.push('## Area assessments');
    lines.push('');
    for (const entry of narrated) {
      lines.push(`### ${getAreaSpec(entry.area)!.label}`);
      lines.push('');
      lines.push(entry.assessment);
      lines.push('');
    }
  }

  if (narrative.keyFindings.length > 0) {
    lines.push('## Key findings');
    lines.push('');
    for (const finding of narrative.keyFindings) lines.push(`- ${finding}`);
    lines.push('');
  }

  if (score.blockers.length > 0) {
    lines.push('## Blocking issues');
    lines.push('');
    for (const blocker of score.blockers) lines.push(`- ${blocker}`);
    lines.push('');
  }

  if (narrative.remediationActions.length > 0) {
    lines.push('## Required remediation');
    lines.push('');
    lines.push('| Priority | Action | Detail |');
    lines.push('| --- | --- | --- |');
    for (const action of narrative.remediationActions) {
      lines.push(
        `| ${action.priority} | ${action.title.replace(/\|/g, '\\|')} | ${action.detail.replace(/\|/g, '\\|')} |`,
      );
    }
    lines.push('');
  }

  if (narrative.residualRisk) {
    lines.push('## Residual risk');
    lines.push('');
    lines.push(narrative.residualRisk);
    lines.push('');
  }

  lines.push('## Recommendation to the approver');
  lines.push('');
  lines.push(narrative.approvalRecommendation);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(
    `_Verdicts in this report are set deterministically against GovSecure's core evaluation parameters. ${
      params.degraded
        ? 'The narrative was generated from the scored evidence without model assistance.'
        : 'The narrative was written by Govi and cannot alter those verdicts.'
    }_`,
  );

  return lines.join('\n');
}

// ─── Entry point ────────────────────────────────────────────────────────────

/**
 * Review an evaluation run and persist the evidence report.
 *
 * `createTasks` raises the recommended remediation as tracked tasks against the
 * entity — which in turn holds Gate 3 shut until they are closed, since
 * approval is only recorded after remediation completes.
 */
export async function reviewEvaluationRun(params: {
  userId: string;
  runId: string;
  createTasks?: boolean;
}): Promise<EvidenceReportResult | null> {
  const scored = await scoreStoredRun(params.userId, params.runId);
  if (!scored) return null;

  const { run, system, score } = scored;

  const digest = buildEvidenceDigest(score, {
    name: system.name,
    entityKind: system.entityKind,
    riskCategory: system.riskCategory,
    purpose: system.purpose,
  });

  const { narrative: llmNarrative, degraded } = await generateNarrative(digest, params.userId);
  const narrative = llmNarrative ?? buildDeterministicNarrative(score, system.name);

  const reportMarkdown = renderEvidenceReport({
    systemName: system.name,
    entityKind: system.entityKind,
    riskCategory: system.riskCategory,
    runLabel: run.runLabel,
    evaluatorTeam: run.evaluatorTeam,
    evaluatorName: run.evaluatorName,
    platform: run.platform,
    evaluatedAt: run.evaluatedAt,
    score,
    narrative,
    degraded,
  });

  await prisma.$transaction(async (tx) => {
    await tx.evaluationRun.update({
      where: { id: run.id },
      data: {
        status: 'reviewed',
        overallVerdict: score.verdict,
        reviewSummary: narrative.executiveSummary,
        reportMarkdown,
        reviewedAt: new Date(),
        reviewedBy: 'govi',
        coverageRatio: score.coverageRatio,
      },
    });

    // Persist the per-result verdicts so the UI and any export show the same
    // judgement the report was written against. Keyed by row id: a run may
    // measure the same parameter more than once with different results.
    for (const result of score.results) {
      if (!result.id) continue;
      await tx.evaluationResult.update({
        where: { id: result.id },
        data: {
          verdict: result.verdict,
          severity: result.severity,
          baselineNote: result.baselineNote,
          gap: result.gap,
        },
      });
    }
  });

  // ── Raise remediation for the findings ──
  if (params.createTasks !== false && narrative.remediationActions.length > 0) {
    const existing = await prisma.remediationTask.findMany({
      where: { aiSystemId: system.id, status: { not: 'done' } },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((t) => t.title.toLowerCase()));

    const fresh = narrative.remediationActions.filter(
      (action) => !existingTitles.has(action.title.toLowerCase()),
    );

    if (fresh.length > 0) {
      await prisma.remediationTask.createMany({
        data: fresh.map((action) => ({
          userId: params.userId,
          organizationId: system.organizationId,
          title: action.title,
          description: `${action.detail}\n\nRaised by Govi from evidence report for evaluation run "${run.runLabel}".`,
          priority: action.priority,
          status: 'todo',
          aiSystemId: system.id,
        })),
      });
    }
  }

  await writeAuditLog({
    actorId: params.userId,
    organizationId: system.organizationId,
    action: 'evaluation.reviewed',
    entityType: 'evaluation_run',
    entityId: run.id,
    summary: `Govi reviewed evaluation run "${run.runLabel}" for "${system.name}": ${verdictBadge(score.verdict)}`,
    metadata: {
      verdict: score.verdict,
      coverageRatio: score.coverageRatio,
      blockers: score.blockers.length,
      degraded,
    },
  });

  await refreshGates(system.id, params.userId);

  return {
    runId: run.id,
    verdict: score.verdict,
    coverageRatio: score.coverageRatio,
    reportMarkdown,
    narrative,
    score,
    degraded,
  };
}
