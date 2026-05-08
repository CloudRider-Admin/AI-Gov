/**
 * Tiered model selection for the advisor surface.
 *
 * Phase 7.2 of the GovSecure integration plan: not every query needs the
 * full GPT-4o + 4-agent pipeline. Lightweight FAQ-style questions can run
 * on a smaller, cheaper model without measurable quality loss.
 *
 * This module is purely a *routing decision* — it picks the model name
 * and records why. The caller is responsible for passing it to the
 * OpenAI SDK and for any fallback behavior.
 *
 * Routing rules (advisor surface, single-agent path):
 *   • FAQ tier  → gpt-4o-mini
 *       - Intent is `advisor` (no generation)
 *       - Query reads as a question (what / how / explain / describe)
 *       - Query is short (≤ 240 chars after trim)
 *       - No high-risk markers in the query
 *   • Standard → gpt-4o
 *       - Anything else: any generation intent, long queries, risk markers
 *
 * Generation orchestrators (intake / document / playbook) are NOT routed
 * by this function — they always run on GPT-4o because their multi-agent
 * synthesis demands the larger model. See `multiAgent.ts`.
 *
 * The `OPENAI_MODEL` env var, if set, overrides routing entirely (escape
 * hatch for evals and demos that need a deterministic model pin).
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md §7.2
 */

import type { ClassifiedIntent } from './intentClassifier';

export type ModelTier = 'faq' | 'standard';

export interface ModelChoice {
  /** OpenAI model id to pass to chat.completions.create */
  model: string;
  /** Routing tier — useful for telemetry */
  tier: ModelTier;
  /** Short human-readable reason (for audit logs) */
  reason: string;
  /** True iff env override pinned the model */
  overridden: boolean;
}

export interface ModelRouterInput {
  query: string;
  /** True when the conversation already has prior turns */
  hasExistingThread?: boolean;
  /** Deterministic intent classification (the LLM-detected intent isn't available pre-call) */
  classifiedIntent: ClassifiedIntent;
}

/** Heuristic question detector — same vocabulary as the intent classifier */
const QUESTION_PATTERN =
  /^\s*(?:what|how|why|when|where|who|which|does|do|is|are|can|should|could|explain|describe|tell\s+me|define)\b/i;

/**
 * Markers that elevate a query to "high-stakes" even if it looks like an FAQ.
 * Keep this list tight — false positives just bump cost, not correctness.
 */
const HIGH_STAKES_PATTERNS: RegExp[] = [
  /\b(?:dpia|gdpr|hipaa|sox|pci-?dss|article\s*\d+|recital\s*\d+)\b/i,
  /\b(?:critical|prohibited|high[-\s]?risk|safety[-\s]?critical|life[-\s]?critical)\b/i,
  /\b(?:incident|breach|violation|enforcement|audit\s+finding|regulator)\b/i,
  /\b(?:biometric|facial\s+recognition|social\s+scoring|predictive\s+policing)\b/i,
];

const FAQ_MAX_LENGTH = 240;
const FAQ_MODEL = 'gpt-4o-mini';
const STANDARD_MODEL = 'gpt-4o';

/**
 * Pick the model + tier for an advisor query.
 */
export function pickAdvisorModel(input: ModelRouterInput): ModelChoice {
  // Env override always wins
  const envModel = process.env.OPENAI_MODEL;
  if (envModel) {
    return {
      model: envModel,
      tier: 'standard',
      reason: 'env-override',
      overridden: true,
    };
  }

  const { query, classifiedIntent } = input;
  const trimmed = query.trim();

  // Generation intents never route to mini
  if (classifiedIntent.type !== 'advisor') {
    return {
      model: STANDARD_MODEL,
      tier: 'standard',
      reason: `intent=${classifiedIntent.type}`,
      overridden: false,
    };
  }

  // Length gate
  if (trimmed.length > FAQ_MAX_LENGTH) {
    return {
      model: STANDARD_MODEL,
      tier: 'standard',
      reason: `length>${FAQ_MAX_LENGTH}`,
      overridden: false,
    };
  }

  // High-stakes markers
  for (const pattern of HIGH_STAKES_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        model: STANDARD_MODEL,
        tier: 'standard',
        reason: 'high-stakes-marker',
        overridden: false,
      };
    }
  }

  // Must look like a question to qualify as FAQ
  if (!QUESTION_PATTERN.test(trimmed)) {
    return {
      model: STANDARD_MODEL,
      tier: 'standard',
      reason: 'not-question-shaped',
      overridden: false,
    };
  }

  return {
    model: FAQ_MODEL,
    tier: 'faq',
    reason: 'faq-question',
    overridden: false,
  };
}

/**
 * Pick the model for the eval rubric judge. Always mini — judging is
 * a structured-output classification task, not a reasoning task.
 */
export function pickJudgeModel(): ModelChoice {
  const envOverride = process.env.OPENAI_JUDGE_MODEL;
  if (envOverride) {
    return { model: envOverride, tier: 'faq', reason: 'judge-env-override', overridden: true };
  }
  return { model: FAQ_MODEL, tier: 'faq', reason: 'judge-default', overridden: false };
}
