/**
 * Eval Harness — LLM judge
 *
 * Uses GPT-4o (separate from the generating model where possible) to score:
 *   1. Voice match against an exemplar drawn from the real GovSecure library.
 *   2. Hallucination flags the deterministic regex tripwires would miss.
 *
 * Mockable: when `EVAL_MOCK=1` (or no `OPENAI_API_KEY` is set), `judgeOutput`
 * returns a deterministic synthetic score so the runner can be exercised in
 * CI and tests without making API calls.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.5.2
 */

import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';

import type { GoldenCase, JudgedScore } from './types';

const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? 'gpt-4o';
const REPO_ROOT = process.cwd();

interface JudgeInput {
  goldenCase: GoldenCase;
  generatedText: string;
}

/**
 * Score the judged components of a case. Falls back to a deterministic mock
 * score whenever live LLM judging is disabled.
 */
export async function judgeOutput(input: JudgeInput): Promise<JudgedScore> {
  if (shouldMock()) {
    return mockJudge(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return mockJudge(input);
  }

  const exemplar = await loadExemplar(input.goldenCase);
  const openai = new OpenAI({ apiKey });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input.goldenCase, input.generatedText, exemplar);

  try {
    const completion = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    return parseJudgeResponse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return {
      voiceMatch: undefined,
      rationale: `judge-error: ${message}`,
      hallucinations: [],
    };
  }
}

function shouldMock(): boolean {
  return process.env.EVAL_MOCK === '1' || process.env.NODE_ENV === 'test';
}

/**
 * Deterministic mock score derived from the input text length and required
 * clause hit-rate. This is intentionally simple — its job is to keep the
 * runner exercisable without an OpenAI key, not to produce useful scores.
 */
function mockJudge(input: JudgeInput): JudgedScore {
  const required = collectRequiredClauses(input.goldenCase);
  const hits = required.filter((c) =>
    input.generatedText.toLowerCase().includes(c.toLowerCase()),
  ).length;
  const ratio = required.length === 0 ? 1 : hits / required.length;
  return {
    voiceMatch: Math.round(ratio * 1000) / 1000,
    rationale: 'mock-judge: derived from required-clause coverage',
    hallucinations: [],
  };
}

function collectRequiredClauses(c: GoldenCase): string[] {
  if (c.category === 'document-generation') return c.requiredClauses;
  if (c.category === 'advisory-query') return c.requiredClauses;
  if (c.category === 'intake') return c.requiredClauses;
  return c.requiredClauses;
}

async function loadExemplar(c: GoldenCase): Promise<string | null> {
  if (c.category !== 'document-generation' || !c.exemplarPath) return null;
  const abs = path.resolve(REPO_ROOT, c.exemplarPath);
  try {
    const raw = await fs.readFile(abs, 'utf8');
    const parsed = JSON.parse(raw) as { sections?: Array<{ heading?: string; paragraphs?: string[] }> };
    if (!parsed.sections) return raw.slice(0, 4000);
    const targetIdx = c.voiceTargetSections?.map((s) => Number(s) - 1) ?? [0, 1];
    const slices = targetIdx
      .map((i) => parsed.sections?.[i])
      .filter((s): s is { heading?: string; paragraphs?: string[] } => Boolean(s))
      .map((s) => `## ${s.heading ?? ''}\n${(s.paragraphs ?? []).join('\n\n')}`);
    return slices.join('\n\n').slice(0, 4000);
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  return `You are an evaluator for GovSecure governance documents.
Return STRICT JSON only.
You assess whether generated output matches the GovSecure brand voice and
flag any fabricated regulatory citations the deterministic checks may have missed.`;
}

function buildUserPrompt(c: GoldenCase, generated: string, exemplar: string | null): string {
  const exemplarBlock = exemplar
    ? `[EXEMPLAR — real GovSecure prose]\n${exemplar}\n\n`
    : '[EXEMPLAR] none provided — score voice against general GovSecure tone (formal, precise, action-oriented).\n\n';

  return `${exemplarBlock}[GOLDEN CASE]
id: ${c.id}
category: ${c.category}

[GENERATED OUTPUT — first 6000 chars]
${generated.slice(0, 6000)}

Score on 0.0–1.0 scales and return JSON of shape:
{
  "voiceMatch": number,        // does prose density, terminology, and tone match the exemplar/GovSecure voice?
  "rationale": string,         // 1-2 sentences explaining the score
  "hallucinations": string[]   // any cited regulations / control IDs that look fabricated
}`;
}

function parseJudgeResponse(raw: string): JudgedScore {
  try {
    const parsed = JSON.parse(raw) as Partial<JudgedScore>;
    const voice = typeof parsed.voiceMatch === 'number' ? clamp01(parsed.voiceMatch) : undefined;
    return {
      voiceMatch: voice,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
      hallucinations: Array.isArray(parsed.hallucinations)
        ? parsed.hallucinations.filter((h): h is string => typeof h === 'string')
        : [],
    };
  } catch {
    return {
      voiceMatch: undefined,
      rationale: 'judge-error: malformed JSON',
      hallucinations: [],
    };
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
