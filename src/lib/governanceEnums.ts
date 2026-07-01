/**
 * Client-safe shared enums for the governance features. This module has NO
 * server-only imports (prisma, resend, crypto), so it can be imported from both
 * server data-access libs and client components without pulling server code
 * into the browser bundle.
 */

// AI System Inventory (Tier 1a) — EU AI Act risk categories, most → least severe.
export const RISK_CATEGORIES = ['prohibited', 'high', 'limited', 'minimal'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const LIFECYCLE_STAGES = ['idea', 'piloting', 'production', 'retired'] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

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
