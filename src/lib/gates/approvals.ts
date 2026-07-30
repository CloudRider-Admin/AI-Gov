/**
 * Gate 3 — Approval & Registry.
 *
 * An approval decision is only recorded when the entity has actually earned it:
 * evaluation evidence reviewed, remediation closed, and the risk tier high
 * enough to need a decision at all. The rules live here rather than in the route
 * handler so the API, Govi, and any future bulk tooling cannot diverge.
 */

import { prisma } from '../prisma';
import { writeAuditLog } from '../audit';
import { refreshGates } from './gates';
import {
  approvalValidityDays,
  requiresApproval,
  riskSeverity,
  type ApprovalDecision,
} from './gateEnums';

export interface ApprovalEligibility {
  required: boolean;
  eligible: boolean;
  reasons: string[];
  openRemediation: number;
  gate2Passed: boolean;
}

/**
 * Whether an approval decision can be recorded right now, and if not, why not.
 * Callers surface `reasons` directly to the user, so they are written as
 * complete sentences.
 */
export async function getApprovalEligibility(aiSystemId: string): Promise<ApprovalEligibility | null> {
  const system = await prisma.aiSystem.findUnique({
    where: { id: aiSystemId },
    select: { id: true, riskCategory: true, status: true },
  });
  if (!system) return null;

  const required = requiresApproval(system.riskCategory);
  const [openRemediation, gate2] = await Promise.all([
    prisma.remediationTask.count({ where: { aiSystemId, status: { not: 'done' } } }),
    prisma.gateRecord.findUnique({
      where: { aiSystemId_gate: { aiSystemId, gate: 2 } },
      select: { status: true },
    }),
  ]);

  const gate2Passed = gate2?.status === 'passed' || gate2?.status === 'waived';
  const reasons: string[] = [];

  if (!required) {
    reasons.push(
      `${system.riskCategory} risk maps to ${riskSeverity(
        system.riskCategory,
      )} severity, which sits below the medium-risk approval threshold. No decision is required.`,
    );
  }
  if (system.status !== 'active') reasons.push('The entity is archived.');
  if (!gate2Passed) reasons.push('Gate 2 has not passed: the evaluation evidence has not been reviewed and cleared.');
  if (openRemediation > 0) {
    reasons.push(
      `${openRemediation} remediation task(s) are still open. Approval is recorded only after remediation has been completed.`,
    );
  }

  return {
    required,
    eligible: required && system.status === 'active' && gate2Passed && openRemediation === 0,
    reasons,
    openRemediation,
    gate2Passed,
  };
}

export interface ApprovalDecisionInput {
  aiSystemId: string;
  actorId: string;
  actorName?: string | null;
  decision: ApprovalDecision;
  note?: string | null;
}

export type ApprovalResult =
  | { ok: true; system: Awaited<ReturnType<typeof prisma.aiSystem.update>> }
  | { ok: false; error: string; reasons: string[] };

/**
 * Record an approval or rejection against a registered entity.
 *
 * A rejection is always allowed once approval is required — an approver must be
 * able to say no even while remediation is outstanding. Only "approved" has to
 * clear the eligibility rules.
 */
export async function recordApprovalDecision(input: ApprovalDecisionInput): Promise<ApprovalResult> {
  const system = await prisma.aiSystem.findUnique({
    where: { id: input.aiSystemId },
    select: { id: true, userId: true, organizationId: true, name: true, entityKind: true, riskCategory: true },
  });
  if (!system) return { ok: false, error: 'Not found', reasons: [] };

  const eligibility = await getApprovalEligibility(input.aiSystemId);
  if (!eligibility) return { ok: false, error: 'Not found', reasons: [] };

  if (!eligibility.required) {
    return {
      ok: false,
      error: 'Approval is not required for this risk tier',
      reasons: eligibility.reasons,
    };
  }

  if (input.decision === 'approved' && !eligibility.eligible) {
    return {
      ok: false,
      error: 'Not eligible for approval yet',
      reasons: eligibility.reasons,
    };
  }

  const now = new Date();
  const validityDays = approvalValidityDays(system.riskCategory);
  const expiresAt =
    input.decision === 'approved' && validityDays
      ? new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000)
      : null;

  const updated = await prisma.aiSystem.update({
    where: { id: input.aiSystemId },
    data: {
      approvalStatus: input.decision,
      approvedById: input.actorId,
      approvedByName: input.actorName ?? null,
      approvedAt: now,
      approvalNote: input.note ?? null,
      approvalExpiresAt: expiresAt,
      ...(input.decision === 'approved' ? { lastReviewedAt: now } : {}),
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    organizationId: system.organizationId,
    action: input.decision === 'approved' ? 'ai_system.approved' : 'ai_system.rejected',
    entityType: 'ai_system',
    entityId: system.id,
    summary: `${input.decision === 'approved' ? 'Approved' : 'Rejected'} ${system.entityKind} "${system.name}" (${system.riskCategory} risk)${
      input.actorName ? ` by ${input.actorName}` : ''
    }`,
    metadata: {
      decision: input.decision,
      riskCategory: system.riskCategory,
      note: input.note ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });

  await refreshGates(input.aiSystemId, input.actorId);

  return { ok: true, system: updated };
}

/**
 * Keep `approvalStatus` consistent with the risk tier after an edit. Raising a
 * minimal-risk entity to high risk must put it back in the approval queue;
 * dropping it below the threshold clears the requirement. An entity that was
 * already approved is re-opened only when its tier rises, since the earlier
 * decision was made against a lighter standard.
 */
export async function reconcileApprovalForRisk(
  aiSystemId: string,
  previousRiskCategory: string,
  nextRiskCategory: string,
  actorId: string,
): Promise<void> {
  if (previousRiskCategory === nextRiskCategory) return;

  const nowRequires = requiresApproval(nextRiskCategory);
  const system = await prisma.aiSystem.findUnique({
    where: { id: aiSystemId },
    select: { approvalStatus: true, organizationId: true, name: true },
  });
  if (!system) return;

  const severityOrder = ['low', 'medium', 'high', 'critical'];
  const rose =
    severityOrder.indexOf(riskSeverity(nextRiskCategory)) >
    severityOrder.indexOf(riskSeverity(previousRiskCategory));

  let nextStatus: string | null = null;
  if (!nowRequires) {
    nextStatus = 'not-required';
  } else if (system.approvalStatus === 'not-required') {
    nextStatus = 'pending';
  } else if (system.approvalStatus === 'approved' && rose) {
    nextStatus = 'pending';
  }

  if (!nextStatus || nextStatus === system.approvalStatus) return;

  await prisma.aiSystem.update({
    where: { id: aiSystemId },
    data: {
      approvalStatus: nextStatus,
      ...(nextStatus === 'pending'
        ? { approvedById: null, approvedByName: null, approvedAt: null, approvalExpiresAt: null }
        : {}),
    },
  });

  await writeAuditLog({
    actorId,
    organizationId: system.organizationId,
    action: 'ai_system.approval_reset',
    entityType: 'ai_system',
    entityId: aiSystemId,
    summary: `Approval status moved to "${nextStatus}" for "${system.name}" after the risk tier changed ${previousRiskCategory} → ${nextRiskCategory}`,
    metadata: { previousRiskCategory, nextRiskCategory, approvalStatus: nextStatus },
  });
}

/** Entities whose approval has lapsed and needs renewing. */
export async function listExpiredApprovals(userId: string) {
  return prisma.aiSystem.findMany({
    where: {
      userId,
      status: 'active',
      approvalStatus: 'approved',
      approvalExpiresAt: { lt: new Date() },
    },
    select: { id: true, name: true, entityKind: true, riskCategory: true, approvalExpiresAt: true },
    orderBy: { approvalExpiresAt: 'asc' },
  });
}
