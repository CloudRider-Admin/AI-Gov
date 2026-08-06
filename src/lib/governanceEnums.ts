/**
 * Client-safe shared enums for the governance features. This module has NO
 * server-only imports (prisma, resend, crypto), so it can be imported from both
 * server data-access libs and client components without pulling server code
 * into the browser bundle.
 */

// AI System Inventory (Tier 1a) — NIST/US impact tiers, most → least severe.
export const RISK_CATEGORIES = ['high', 'moderate', 'low'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const LIFECYCLE_STAGES = ['idea', 'piloting', 'production', 'retired'] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

// Registry entity types — use-cases and agents are individual entities (Gate 3).
export const ENTITY_TYPES = ['system', 'model', 'agent', 'use-case'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  system: 'System',
  model: 'Model',
  agent: 'Agent',
  'use-case': 'Use-case',
};

// Gate 3 — Approval & Registry. Approval only applies to medium/high risk.
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Approval is only required for medium (moderate) and high risk entries. */
export function requiresApproval(riskCategory: string): boolean {
  return riskCategory === 'high' || riskCategory === 'moderate';
}

// Gate 2 — Evaluation & Review. Where evaluation evidence was produced.
export const EVALUATION_SOURCES = ['data-science', 'engineering', 'red-team', 'platform'] as const;
export type EvaluationSource = (typeof EVALUATION_SOURCES)[number];

export const EVALUATION_SOURCE_LABELS: Record<EvaluationSource, string> = {
  'data-science': 'Data science',
  engineering: 'Engineering',
  'red-team': 'Red team',
  platform: 'AI platform',
};

// Gate 2 — evidence report verdicts.
export const REPORT_VERDICTS = ['pass', 'conditional-pass', 'fail'] as const;
export type ReportVerdict = (typeof REPORT_VERDICTS)[number];

// Compliance posture (Tier 1b).
export const ASSESSMENT_STATUSES = [
  'not-started',
  'in-progress',
  'implemented',
  'not-applicable',
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

// Remediation tasks (Tier 1c).
export const TASK_STATUSES = ['todo', 'in-progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// Team invitations (Tier 2).
export const INVITE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

// Artifact review/approval workflow (Tier 2).
export const REVIEW_STATUSES = ['draft', 'in-review', 'approved'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
