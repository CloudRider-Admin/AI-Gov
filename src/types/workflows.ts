/**
 * Multi-turn workflow types — Phase 3.5.
 *
 * Powers the WorkflowOrchestrator that backs TPRM, the 90-Day Blueprint
 * progress tracker, and any future questionnaire-style assessments. Generic
 * by design so a new workflow definition is mostly a data + finalizer change.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 3.5
 */

import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';

/** Discriminator for the persisted workflow. Add a string here when wiring a new workflow. */
export type WorkflowType = 'tprm' | '90day-blueprint' | 'risk-assessment';

export type WorkflowStatus = 'in-progress' | 'paused' | 'completed' | 'abandoned';

/** Allowed shapes for a step's response input. */
export type ResponseType =
  | 'text'         // free-form prose
  | 'longText'     // multi-paragraph
  | 'boolean'      // yes/no
  | 'choice'       // single choice from `options`
  | 'multiChoice'  // multiple choices from `options`
  | 'score'        // 1-5 (or 0-3) scaled integer
  | 'evidenceLink';// URL or document reference

export interface ScoringRubric {
  /** Scale label, e.g. "1-5 (1=No, 5=Mature)". */
  scale: string;
  /** Optional anchors per integer value, used to drive the UI. */
  anchors?: Record<number, string>;
  /** Threshold below which the answer counts as a deficiency. */
  deficiencyBelow?: number;
}

/** Severity for a tripped red-flag rule. */
export type RedFlagSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RedFlag {
  /** Step that produced the flag. */
  sectionId: string;
  /** Human label (shown in the UI). */
  label: string;
  severity: RedFlagSeverity;
  /** Why the flag fired — used in the executive summary. */
  reason: string;
}

/** Result of validating a submitted answer. */
export interface ValidationResult {
  ok: boolean;
  message?: string;
}

/**
 * One question in a workflow. Pure data — no orchestration logic.
 * `validation`, `scoring`, and `redFlagCheck` are pure functions so the
 * workflow definition is structurally serializable up to those callbacks.
 */
export interface WorkflowStep {
  sectionId: string;
  /** Optional grouping (e.g. "1. AI System Overview"). */
  sectionGroup?: string;
  question: string;
  responseType: ResponseType;
  options?: string[];
  required?: boolean;
  helpText?: string;
  validation?: (input: unknown) => ValidationResult;
  scoringRubric?: ScoringRubric;
  /** Returns a RedFlag when the answer should trip the rule, otherwise null. */
  redFlagCheck?: (answer: unknown) => RedFlag | null;
}

/** Persisted answer for one step. */
export interface WorkflowAnswer {
  value: unknown;
  /** Numeric score derived from the answer + rubric. */
  score?: number;
  answeredAt: string;
}

export interface WorkflowState {
  sessionId: string;
  workflowType: WorkflowType;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  answers: Record<string, WorkflowAnswer>;
  scores: Record<string, number>;
  redFlags: RedFlag[];
  /** Free-form context the caller passed at startSession (org name, etc.). */
  context: Record<string, unknown>;
}

/** Result returned by `submitAnswer` — either advances or finishes. */
export interface WorkflowStepResult {
  state: WorkflowState;
  /** When the workflow has more steps, this is the next one. */
  nextStep: WorkflowStep | null;
  /** Set when `currentStep` reached `totalSteps`. The caller should call `finalize`. */
  done: boolean;
  /** Non-fatal warning (validation message that didn't reject the input). */
  warning?: string;
}

/** Output returned by `finalize` — the artifact-ready document plus telemetry. */
export interface WorkflowFinalizeOutput {
  document: GovernanceDocumentOutput;
  /** Aggregate executive scoring summary, e.g. average score, red-flag count. */
  summary: {
    totalSteps: number;
    answered: number;
    averageScore?: number;
    redFlagCount: number;
    deficiencies: string[];
  };
}

/**
 * Definition of one workflow — the immutable steps + finalizer used by
 * `WorkflowOrchestrator`. Workflows live in `src/lib/ai/workflows/*.ts`.
 */
export interface WorkflowDefinition {
  type: WorkflowType;
  /** Human-readable label (shown to the user in the panel header). */
  label: string;
  steps: WorkflowStep[];
  finalize: (state: WorkflowState) => Promise<WorkflowFinalizeOutput>;
}
