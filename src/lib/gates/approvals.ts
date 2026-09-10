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
 * Whether this actor may record a decision on this entity at all — separate from
 * whether the entity has earned one.
 *
 * `selfRecorded` is not a failure. Separation of duties is enforced wherever a
 * second person exists to enforce it against; a single-operator workspace has
 * nobody else, and refusing outright would make the gate unusable for the
 * majority of accounts. So the decision proceeds and is stamped as
 * self-recorded, which is the honest answer to give an assessor.
 */
export type ApprovalAuthority =
  | { permitted: true; selfRecorded: boolean }
  | { permitted: false; reason: string };

/**
 * A second member who could act as the approver. Membership is read through the
 * owner's organizations rather than the entity's, because `AiSystem.organizationId`
 * is not yet populated — see the org-scoping work. When it is, this should read
 * the entity's organization directly.
 */
async function hasSeparateApprover(ownerId: string, actorId: string): Promise<string | null> {
  const memberships = await prisma.orgMember.findMany({
    where: { userId: ownerId },
    select: { organizationId: true, organization: { select: { name: true } } },
  });
  if (memberships.length === 0) return null;

  const orgIds = memberships.map((m) => m.organizationId);
  const others = await prisma.orgMember.findFirst({
    where: { organizationId: { in: orgIds }, userId: { notIn: [ownerId, actorId] } },
    select: { organizationId: true },
  });
  if (!others) return null;

  const org = memberships.find((m) => m.organizationId === others.organizationId);
  return org?.organization.name ?? 'this workspace';
}

export async function getApprovalAuthority(
  ownerId: string,
  actorId: string,
): Promise<ApprovalAuthority> {
  // A different person is recording the decision — separation of duties holds.
  if (actorId !== ownerId) return { permitted: true, selfRecorded: false };

  const orgName = await hasSeparateApprover(ownerId, actorId);
  if (orgName) {
    return {
      permitted: false,
      reason: `You registered this entity, so you cannot also approve it. Ask another member of ${orgName} to record the decision.`,
    };
  }

  return { permitted: true, selfRecorded: true };
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
 * clear the eligibility rules. Both are subject to separation of duties.
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

  // Separation of duties is checked before eligibility so the owner of an
  // otherwise-eligible entity gets told who has to sign, not that it is ready.
  const authority = await getApprovalAuthority(system.userId, input.actorId);
  if (!authority.permitted) {
    return {
      ok: false,
      error: 'Separation of duties: a different approver is required',
      reasons: [authority.reason],
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
      approvalSelfRecorded: authority.selfRecorded,
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
    }${authority.selfRecorded ? ' — self-recorded by the owner; no separate approver exists in this workspace' : ''}`,
    metadata: {
      decision: input.decision,
      riskCategory: system.riskCategory,
      note: input.note ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      selfRecorded: authority.selfRecorded,
    },
  });

  await refreshGates(input.aiSystemId, input.actorId);

  return { ok: true, system: updated };
}

/**
 * Withdraw a recorded approval or rejection, returning the entity to the
 * approval queue.
 *
 * This is a reversal of a governance decision, not a decision in itself, so it
 * is deliberately separate from `recordApprovalDecision` — and it demands a
 * written reason for the same reason a waiver does: an unexplained reversal in
 * the audit trail is worse than no reversal at all.
 */
export async function withdrawApprovalDecision(input: {
  aiSystemId: string;
  actorId: string;
  actorName?: string | null;
  reason: string;
}): Promise<ApprovalResult> {
  const system = await prisma.aiSystem.findUnique({
    where: { id: input.aiSystemId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      entityKind: true,
      riskCategory: true,
      approvalStatus: true,
      approvedByName: true,
    },
  });
  if (!system) return { ok: false, error: 'Not found', reasons: [] };

  if (system.approvalStatus !== 'approved' && system.approvalStatus !== 'rejected') {
    return {
      ok: false,
      error: 'There is no recorded decision to withdraw',
      reasons: [
        system.approvalStatus === 'pending'
          ? 'This entity is already awaiting a decision.'
          : 'Approval is not required for this entity, so no decision was recorded.',
      ],
    };
  }

  const previous = system.approvalStatus;
  const updated = await prisma.aiSystem.update({
    where: { id: input.aiSystemId },
    data: {
      approvalStatus: 'pending',
      approvedById: null,
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      approvalExpiresAt: null,
      approvalNote: input.reason,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    organizationId: system.organizationId,
    action: 'ai_system.approval_withdrawn',
    entityType: 'ai_system',
    entityId: system.id,
    summary: `Withdrew the ${previous} decision on ${system.entityKind} "${system.name}"${
      input.actorName ? ` — withdrawn by ${input.actorName}` : ''
    }: ${input.reason}`,
    metadata: {
      previousStatus: previous,
      previousDecidedBy: system.approvedByName,
      reason: input.reason,
      riskCategory: system.riskCategory,
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

  // `undefined` means nothing to change; `null` clears the approval requirement,
  // which is a real column value and so cannot double as the no-op sentinel.
  let nextStatus: string | null | undefined;
  if (!nowRequires) {
    nextStatus = null;
  } else if (system.approvalStatus === null) {
    nextStatus = 'pending';
  } else if (system.approvalStatus === 'approved' && rose) {
    nextStatus = 'pending';
  }

  if (nextStatus === undefined || nextStatus === system.approvalStatus) return;

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
    summary: `Approval status moved to "${nextStatus ?? 'not required'}" for "${system.name}" after the risk tier changed ${previousRiskCategory} → ${nextRiskCategory}`,
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
