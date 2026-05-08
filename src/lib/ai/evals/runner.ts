/**
 * Eval Harness — runner
 *
 * Loads every `*.golden.json` under `src/lib/ai/evals/golden/`, dispatches
 * each case to the matching orchestrator (or to a direct chat completion for
 * advisory queries), scores the rendered output via `rubric.ts` + `judge.ts`,
 * and emits an aggregated `EvalReport`.
 *
 * Runs in two modes:
 *   - LIVE (default): calls real orchestrators / OpenAI. Requires OPENAI_API_KEY.
 *   - MOCK (EVAL_MOCK=1, NODE_ENV=test, or no API key): returns deterministic
 *     synthetic outputs. Used by CI to verify the harness shape and by vitest.
 *
 * Cases targeting orchestrators that don't yet exist (e.g. Phase 2's
 * `govsecure-aup` documentType) are reported as `skipped` so the corpus can
 * be authored ahead of the implementation.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.5.3
 */

import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';

import {
  documentOrchestrator,
  intakeOrchestrator,
  playbookOrchestrator,
} from '@/lib/ai/multiAgent';
import { GOVERNANCE_SYSTEM_PROMPT } from '@/lib/ai/systemPrompt';
import { judgeOutput } from './judge';
import {
  buildCaseScore,
  PASS_THRESHOLD,
  RUBRIC_VERSION,
  scoreDeterministic,
} from './rubric';
import type {
  AdvisoryGolden,
  CaseScore,
  DocumentGenerationGolden,
  EvalReport,
  GoldenCase,
  GoldenCategory,
  IntakeGolden,
  PlaybookGolden,
} from './types';

import { DOCUMENT_TYPE_VALUES } from '@/lib/ai/schemas';

const SUPPORTED_DOCUMENT_TYPES = new Set<string>(DOCUMENT_TYPE_VALUES);

const ADVISORY_MODEL = process.env.EVAL_ADVISORY_MODEL ?? 'gpt-4o-mini';
const REPORT_DIR_DEFAULT = path.join(process.cwd(), 'evals', 'reports');
const GOLDEN_DIR_DEFAULT = path.join(process.cwd(), 'src', 'lib', 'ai', 'evals', 'golden');

export interface RunOptions {
  goldenDir?: string;
  reportDir?: string;
  /** Override for the API key. Defaults to process.env.OPENAI_API_KEY. */
  apiKey?: string;
  /** When true, no OpenAI calls are made and all outputs are synthetic. */
  mock?: boolean;
  /** Skip writing the JSON report to disk (used in tests). */
  noWriteReport?: boolean;
  /** Optional filter — only run cases whose id matches. */
  filter?: (id: string) => boolean;
}

/** Top-level entry point. */
export async function runEvalSuite(opts: RunOptions = {}): Promise<EvalReport> {
  const startedAt = new Date();
  const goldenDir = opts.goldenDir ?? GOLDEN_DIR_DEFAULT;
  const reportDir = opts.reportDir ?? REPORT_DIR_DEFAULT;
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  const mock = resolveMockMode(opts.mock, apiKey);

  const cases = await loadGoldenCases(goldenDir);
  const filtered = opts.filter ? cases.filter((c) => opts.filter!(c.id)) : cases;

  const scores: CaseScore[] = [];
  for (const gc of filtered) {
    const t0 = Date.now();
    try {
      const dispatch = await dispatchCase(gc, { apiKey, mock });
      if (dispatch.skipped) {
        scores.push(buildSkippedScore(gc, dispatch.reason ?? 'skipped', Date.now() - t0));
        continue;
      }

      const det = scoreDeterministic(dispatch.text, {
        expectedSections: collectExpectedSections(gc),
        requiredClauses: gc.requiredClauses,
        forbiddenContent: gc.forbiddenContent,
      });

      const judged = await judgeOutput({ goldenCase: gc, generatedText: dispatch.text });
      scores.push(buildCaseScore(gc, det, judged, Date.now() - t0));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      scores.push(buildErrorScore(gc, message, Date.now() - t0));
    }
  }

  const report = buildReport(scores, startedAt);
  if (!opts.noWriteReport) {
    await writeReport(reportDir, report);
  }
  return report;
}

interface DispatchResult {
  text: string;
  skipped?: boolean;
  reason?: string;
}

async function dispatchCase(
  gc: GoldenCase,
  ctx: { apiKey: string; mock: boolean },
): Promise<DispatchResult> {
  if (ctx.mock) {
    return { text: synthesiseMockOutput(gc) };
  }

  switch (gc.category) {
    case 'document-generation':
      return dispatchDocument(gc, ctx.apiKey);
    case 'intake':
      return dispatchIntake(gc, ctx.apiKey);
    case 'playbook':
      return dispatchPlaybook(gc, ctx.apiKey);
    case 'advisory-query':
      return dispatchAdvisory(gc, ctx.apiKey);
    default:
      return { text: '', skipped: true, reason: 'unknown category' };
  }
}

async function dispatchDocument(
  gc: DocumentGenerationGolden,
  apiKey: string,
): Promise<DispatchResult> {
  if (!SUPPORTED_DOCUMENT_TYPES.has(gc.documentType)) {
    return {
      text: '',
      skipped: true,
      reason: `documentType "${gc.documentType}" not yet implemented (Phase 2)`,
    };
  }
  const result = await documentOrchestrator.run(
    {
      documentType: gc.documentType as Parameters<typeof documentOrchestrator.run>[0]['documentType'],
      riskTier: gc.input.riskTier,
      useCaseDescription: gc.input.useCaseDescription,
      useCaseName: gc.input.useCaseName,
      context: gc.input.context,
    },
    apiKey,
  );
  return { text: result.markdownExport };
}

async function dispatchIntake(gc: IntakeGolden, apiKey: string): Promise<DispatchResult> {
  const result = await intakeOrchestrator.run(
    {
      useCaseDescription: gc.input.useCaseDescription,
      useCaseName: gc.input.useCaseName,
    },
    apiKey,
  );
  return { text: result.markdownExport };
}

async function dispatchPlaybook(gc: PlaybookGolden, apiKey: string): Promise<DispatchResult> {
  const result = await playbookOrchestrator.run(
    {
      framework: gc.input.framework,
      riskTier: gc.input.riskTier,
      useCaseDescription: gc.input.useCaseDescription,
      useCaseName: gc.input.useCaseName,
      focusAreas: gc.input.focusAreas,
    },
    apiKey,
  );
  return { text: result.markdownExport };
}

async function dispatchAdvisory(gc: AdvisoryGolden, apiKey: string): Promise<DispatchResult> {
  if (!apiKey) {
    return { text: '', skipped: true, reason: 'no OPENAI_API_KEY for advisory dispatch' };
  }
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: ADVISORY_MODEL,
    temperature: 0.2,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: GOVERNANCE_SYSTEM_PROMPT },
      { role: 'user', content: gc.input.message },
    ],
  });
  return { text: completion.choices[0]?.message?.content ?? '' };
}

function collectExpectedSections(gc: GoldenCase): string[] {
  if (gc.category === 'document-generation') return gc.expectedSections;
  if (gc.category === 'playbook') return gc.expectedPhases;
  if (gc.category === 'intake') return gc.expectedTriggers ?? [];
  return [];
}

/** Synthetic deterministic output used in mock mode. Mixes in required
 *  clauses + section names so most cases pass the rubric, with a small
 *  amount of unrelated text to keep things realistic. */
function synthesiseMockOutput(gc: GoldenCase): string {
  const sections = collectExpectedSections(gc);
  const lines: string[] = [
    `# Mock Output for ${gc.id}`,
    `Category: ${gc.category}`,
    '',
  ];
  for (const s of sections) {
    lines.push(`## ${s}`);
    lines.push(`Substantive content for ${s} grounded in the use case.`);
    lines.push('');
  }
  if (gc.requiredClauses.length) {
    lines.push('## Coverage');
    for (const c of gc.requiredClauses) lines.push(`- includes ${c}`);
  }
  if (gc.category === 'intake') {
    lines.push('');
    lines.push(`Risk Tier: ${gc.expectedRiskTier}`);
    if (gc.expectedRiskTier === 'Critical') {
      lines.push('Launch Decision: No-Go');
      lines.push('EU AI Act Classification: Prohibited');
    } else {
      lines.push('Launch Decision: Conditional Go');
    }
  }
  return lines.join('\n');
}

function buildSkippedScore(gc: GoldenCase, reason: string, durationMs: number): CaseScore {
  return {
    caseId: gc.id,
    category: gc.category,
    deterministic: {
      structureMatch: 0,
      requiredClausesPresent: 0,
      hallucinationCheck: 'pass',
      missingClauses: [],
      forbiddenHits: [],
    },
    judged: { rationale: `skipped: ${reason}` },
    overall: 0,
    passed: false,
    error: `skipped: ${reason}`,
    durationMs,
  };
}

function buildErrorScore(gc: GoldenCase, message: string, durationMs: number): CaseScore {
  return {
    caseId: gc.id,
    category: gc.category,
    deterministic: {
      structureMatch: 0,
      requiredClausesPresent: 0,
      hallucinationCheck: 'fail',
      missingClauses: [],
      forbiddenHits: [`orchestrator-error:${message}`],
    },
    judged: { rationale: `error: ${message}` },
    overall: 0,
    passed: false,
    error: message,
    durationMs,
  };
}

function buildReport(scores: CaseScore[], startedAt: Date): EvalReport {
  const nonErrored = scores.filter((s) => !s.error);
  const passed = scores.filter((s) => s.passed).length;
  const failed = scores.filter((s) => !s.passed && !s.error).length;
  const errored = scores.filter((s) => Boolean(s.error)).length;
  const passRate = nonErrored.length === 0 ? 0 : passed / nonErrored.length;
  const meanOverall =
    nonErrored.length === 0
      ? 0
      : nonErrored.reduce((acc, s) => acc + s.overall, 0) / nonErrored.length;

  const byCategory: EvalReport['byCategory'] = {
    'document-generation': emptyCategoryRow(),
    'advisory-query': emptyCategoryRow(),
    intake: emptyCategoryRow(),
    playbook: emptyCategoryRow(),
  };
  for (const s of scores) {
    const row = byCategory[s.category];
    row.total += 1;
    if (s.passed) row.passed += 1;
    if (!s.error) row.meanOverall += s.overall;
  }
  for (const cat of Object.keys(byCategory) as GoldenCategory[]) {
    const r = byCategory[cat];
    const nonErr = scores.filter((s) => s.category === cat && !s.error).length;
    r.passRate = nonErr === 0 ? 0 : r.passed / nonErr;
    r.meanOverall = nonErr === 0 ? 0 : round3(r.meanOverall / nonErr);
    r.passRate = round3(r.passRate);
  }

  return {
    startedAt: startedAt.toISOString(),
    durationSec: Math.round(((Date.now() - startedAt.getTime()) / 1000) * 100) / 100,
    rubricVersion: RUBRIC_VERSION,
    totalCases: scores.length,
    passed,
    failed,
    errored,
    passRate: round3(passRate),
    meanOverall: round3(meanOverall),
    byCategory,
    cases: scores,
  };
}

function emptyCategoryRow() {
  return { total: 0, passed: 0, passRate: 0, meanOverall: 0 };
}

async function loadGoldenCases(dir: string): Promise<GoldenCase[]> {
  const entries = await fs.readdir(dir);
  const files = entries.filter((f) => f.endsWith('.golden.json')).sort();
  const cases: GoldenCase[] = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(dir, f), 'utf8');
    const parsed = JSON.parse(raw) as GoldenCase;
    cases.push(parsed);
  }
  return cases;
}

async function writeReport(reportDir: string, report: EvalReport): Promise<void> {
  await fs.mkdir(reportDir, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const file = path.join(reportDir, `${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  // Always overwrite the convenience pointer to the latest run.
  await fs.writeFile(path.join(reportDir, 'latest.json'), JSON.stringify(report, null, 2));
}

function resolveMockMode(explicit: boolean | undefined, apiKey: string): boolean {
  if (typeof explicit === 'boolean') return explicit;
  if (process.env.EVAL_MOCK === '1') return true;
  if (process.env.NODE_ENV === 'test') return true;
  return !apiKey;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export const PASS_RATE_THRESHOLD = PASS_THRESHOLD;
