/**
 * Client-safe enums and pure predicates for the three governance gates.
 * No server-only imports — the gate UI and the server libs share this module.
 */

import type { RiskCategory } from '../governanceEnums';

// ─── Registered entity kinds ────────────────────────────────────────────────
// The register holds use cases, agents, and models as first-class entities.
// All three run the same gate sequence; only the evidence emphasis differs.
export const ENTITY_KINDS = ['use-case', 'agent', 'model'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  'use-case': 'Use case',
  agent: 'Agent',
  model: 'Model',
};

export function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}

// ─── Gates ──────────────────────────────────────────────────────────────────
export const GATES = [1, 2, 3] as const;
export type GateNumber = (typeof GATES)[number];

export const GATE_STATUSES = ['not-started', 'in-progress', 'passed', 'failed', 'waived'] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

export interface GateSpec {
  gate: GateNumber;
  slug: string;
  name: string;
  purpose: string;
  /** What has to be true for the gate to pass. */
  exitCriteria: string[];
}

export const GATE_SPECS: Record<GateNumber, GateSpec> = {
  1: {
    gate: 1,
    slug: 'intake',
    name: 'Intake & Risk Tiering',
    purpose:
      'Register the use case, agent, or model and establish its risk tier before any evaluation work begins.',
    exitCriteria: [
      'Entity kind, name, and purpose recorded',
      'Business owner named',
      'Risk tier assigned against the EU AI Act categories',
      'Data types processed declared',
    ],
  },
  2: {
    gate: 2,
    slug: 'evaluation',
    name: 'Evaluation & Review',
    purpose:
      'Collect evaluation results from data science, engineering, and red team, then review that evidence against the core evaluation parameters and issue an evidence report.',
    exitCriteria: [
      'At least one evaluation run ingested',
      'Every mandatory core review area carries evidence',
      'Govi evidence report produced',
      'Overall verdict is a pass or a conditional pass with remediation raised',
    ],
  },
  3: {
    gate: 3,
    slug: 'approval',
    name: 'Approval & Registry',
    purpose:
      'Record a named approval decision once remediation is complete, and publish the entity to the register.',
    exitCriteria: [
      'Gate 2 passed',
      'No open remediation tasks against the entity',
      'Approval decision recorded with an approver and a date',
    ],
  },
};

export function gateSpec(gate: number): GateSpec | undefined {
  return GATE_SPECS[gate as GateNumber];
}

// ─── Approval ───────────────────────────────────────────────────────────────
export const APPROVAL_STATUSES = ['not-required', 'pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** The decisions an approver can actually record (excludes the derived states). */
export const APPROVAL_DECISIONS = ['approved', 'rejected'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export function isApprovalDecision(value: string): value is ApprovalDecision {
  return (APPROVAL_DECISIONS as readonly string[]).includes(value);
}

// ─── Risk severity ──────────────────────────────────────────────────────────
/**
 * The register tiers entities with the EU AI Act's four categories, while the
 * approval policy is written in coarse severity bands (approval is required for
 * medium and high risk). This is the single place the two vocabularies meet.
 */
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export const RISK_SEVERITY: Record<RiskCategory, RiskSeverity> = {
  minimal: 'low',
  limited: 'medium',
  high: 'high',
  prohibited: 'critical',
};

const SEVERITY_ORDER: RiskSeverity[] = ['low', 'medium', 'high', 'critical'];

export function riskSeverity(riskCategory: string): RiskSeverity {
  return RISK_SEVERITY[riskCategory as RiskCategory] ?? 'medium';
}

/** True when `severity` is at least as severe as `floor`. */
export function severityAtLeast(severity: RiskSeverity, floor: RiskSeverity): boolean {
  return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(floor);
}

/**
 * Approval is required for medium risk and above. Minimal-risk entities
 * (severity low) are registered without an approval decision.
 */
export function requiresApproval(riskCategory: string): boolean {
  return severityAtLeast(riskSeverity(riskCategory), 'medium');
}

/**
 * How long an approval stands before it must be renewed. Higher risk earns a
 * shorter leash; low risk never expires because it never needed approval.
 */
export function approvalValidityDays(riskCategory: string): number | null {
  switch (riskSeverity(riskCategory)) {
    case 'critical':
      return 90;
    case 'high':
      return 180;
    case 'medium':
      return 365;
    default:
      return null;
  }
}
