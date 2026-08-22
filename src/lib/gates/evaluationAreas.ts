/**
 * The twelve core evaluation areas — the single source of truth for their ids
 * and display labels.
 *
 * Two modules describe these areas for different purposes:
 *
 *   - `src/data/coreEvaluationParameters.ts` carries the prose spec (what the
 *     evaluators examine, the example baseline) used by the inventory drawer,
 *     the knowledge base, and Govi's seed content.
 *   - `src/lib/gates/coreEvaluationParameters.ts` carries the machine spec
 *     (comparator, unit, threshold, aliases) used by the deterministic scorer.
 *
 * The two shapes are legitimately different and merge only when the two Gate 2
 * evidence paths are unified. What must never diverge is the area *identity*:
 * `id` is persisted on `EvaluationEvidence.reviewArea` and
 * `EvaluationResult.area`, so a mismatch between the modules silently orphans
 * stored evidence. Both import their ids from here, and the test alongside this
 * file fails if either drifts.
 */

export const CORE_EVALUATION_AREAS = [
  'business-effectiveness',
  'response-quality',
  'factual-reliability',
  'rag-performance',
  'safety',
  'security',
  'fairness',
  'privacy',
  'robustness',
  'agent-behavior',
  'operational-performance',
  'human-oversight',
] as const;

export type EvaluationArea = (typeof CORE_EVALUATION_AREAS)[number];

/** Display label for each area. Used in reports, exports, and both UIs. */
export const AREA_LABELS: Record<EvaluationArea, string> = {
  'business-effectiveness': 'Business effectiveness',
  'response-quality': 'Response quality',
  'factual-reliability': 'Factual reliability',
  'rag-performance': 'RAG performance',
  safety: 'Safety',
  security: 'Security',
  fairness: 'Fairness',
  privacy: 'Privacy',
  robustness: 'Robustness',
  'agent-behavior': 'Agent behavior',
  'operational-performance': 'Operational performance',
  'human-oversight': 'Human oversight',
};

/**
 * Areas where a below-baseline result fails the evidence report outright,
 * rather than downgrading it to a conditional pass.
 */
export const CRITICAL_AREAS: readonly EvaluationArea[] = [
  'safety',
  'security',
  'privacy',
  'agent-behavior',
];

export function isEvaluationArea(value: string): value is EvaluationArea {
  return (CORE_EVALUATION_AREAS as readonly string[]).includes(value);
}

export function isCriticalArea(area: string): boolean {
  return (CRITICAL_AREAS as readonly string[]).includes(area);
}
