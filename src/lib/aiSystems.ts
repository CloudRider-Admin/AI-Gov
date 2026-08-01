import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import {
  RISK_CATEGORIES,
  LIFECYCLE_STAGES,
  ENTITY_TYPES,
  APPROVAL_STATUSES,
  requiresApproval,
  type RiskCategory,
  type LifecycleStage,
  type EntityType,
  type ApprovalStatus,
} from './governanceEnums';

export { RISK_CATEGORIES, LIFECYCLE_STAGES, ENTITY_TYPES, APPROVAL_STATUSES, requiresApproval };
export type { RiskCategory, LifecycleStage, EntityType, ApprovalStatus };

export interface AiSystemInput {
  name: string;
  description?: string | null;
  purpose?: string | null;
  businessOwner?: string | null;
  vendor?: string | null;
  model?: string | null;
  entityType?: EntityType;
  lifecycleStage?: LifecycleStage;
  riskCategory?: RiskCategory;
  dataTypes?: string[];
  deployedAt?: string | null;
  nextReviewAt?: string | null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** List AI systems visible to a user (personal scope; org scope layered in Tier 2). */
export async function listAiSystems(userId: string) {
  return prisma.aiSystem.findMany({
    where: { userId, status: 'active' },
    orderBy: [{ riskCategory: 'asc' }, { updatedAt: 'desc' }],
  });
}

export async function getAiSystem(userId: string, id: string) {
  const system = await prisma.aiSystem.findUnique({ where: { id } });
  if (!system || system.userId !== userId) return null;
  return system;
}

export async function createAiSystem(userId: string, input: AiSystemInput) {
  const riskCategory = input.riskCategory ?? 'moderate';
  const system = await prisma.aiSystem.create({
    data: {
      userId,
      name: input.name.trim(),
      description: input.description ?? null,
      purpose: input.purpose ?? null,
      businessOwner: input.businessOwner ?? null,
      vendor: input.vendor ?? null,
      model: input.model ?? null,
      entityType: input.entityType ?? 'system',
      lifecycleStage: input.lifecycleStage ?? 'idea',
      riskCategory,
      dataTypes: input.dataTypes ?? [],
      // Gate 3: medium/high risk entries require an approval decision and
      // start out pending; low risk needs no approval.
      approvalStatus: requiresApproval(riskCategory) ? 'pending' : null,
      deployedAt: parseDate(input.deployedAt),
      nextReviewAt: parseDate(input.nextReviewAt),
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'ai_system.created',
    entityType: 'ai_system',
    entityId: system.id,
    summary: `Registered AI ${system.entityType} "${system.name}" (${system.riskCategory} risk)`,
  });

  return system;
}

export async function updateAiSystem(userId: string, id: string, input: Partial<AiSystemInput>) {
  const existing = await getAiSystem(userId, id);
  if (!existing) return null;

  // Gate 3: keep approval consistent when the risk tier changes. Dropping to
  // low clears the approval requirement; entering medium/high re-opens it as
  // pending so the decision is made against the new tier.
  const riskChanged = input.riskCategory !== undefined && input.riskCategory !== existing.riskCategory;
  const approvalTransition = riskChanged
    ? requiresApproval(input.riskCategory as string)
      ? { approvalStatus: 'pending', approvedBy: null, approvedAt: null, approvalNote: null }
      : { approvalStatus: null, approvedBy: null, approvedAt: null, approvalNote: null }
    : {};

  const system = await prisma.aiSystem.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      ...(input.businessOwner !== undefined ? { businessOwner: input.businessOwner } : {}),
      ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
      ...(input.lifecycleStage !== undefined ? { lifecycleStage: input.lifecycleStage } : {}),
      ...(input.riskCategory !== undefined ? { riskCategory: input.riskCategory } : {}),
      ...(input.dataTypes !== undefined ? { dataTypes: input.dataTypes } : {}),
      ...(input.deployedAt !== undefined ? { deployedAt: parseDate(input.deployedAt) } : {}),
      ...(input.nextReviewAt !== undefined ? { nextReviewAt: parseDate(input.nextReviewAt) } : {}),
      ...approvalTransition,
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'ai_system.updated',
    entityType: 'ai_system',
    entityId: system.id,
    summary: `Updated AI system "${system.name}"`,
  });

  return system;
}

/**
 * Gate 3 — record an approval decision (Approved / Pending / Rejected) for a
 * medium/high risk agent, model, or use-case after remediation is complete.
 * `approverName` is the display identity of the session user making the call.
 */
export async function setApprovalStatus(
  userId: string,
  id: string,
  status: ApprovalStatus,
  approverName: string,
  note?: string | null,
) {
  const existing = await getAiSystem(userId, id);
  if (!existing) return null;
  if (!requiresApproval(existing.riskCategory)) {
    return { error: 'Approval only applies to medium and high risk entries' } as const;
  }

  const decided = status === 'approved' || status === 'rejected';
  const system = await prisma.aiSystem.update({
    where: { id },
    data: {
      approvalStatus: status,
      approvedBy: decided ? approverName : null,
      approvedAt: decided ? new Date() : null,
      approvalNote: note ?? null,
    },
  });

  writeAuditLog({
    actorId: userId,
    action: `ai_system.approval.${status}`,
    entityType: 'ai_system',
    entityId: id,
    summary: decided
      ? `${status === 'approved' ? 'Approved' : 'Rejected'} AI ${existing.entityType} "${existing.name}" (${existing.riskCategory} risk) by ${approverName}`
      : `Reset approval of AI ${existing.entityType} "${existing.name}" to pending`,
  });

  return { system } as const;
}

/** Soft-delete (archive) so the audit trail and linked records survive. */
export async function archiveAiSystem(userId: string, id: string) {
  const existing = await getAiSystem(userId, id);
  if (!existing) return null;

  const system = await prisma.aiSystem.update({
    where: { id },
    data: { status: 'archived' },
  });

  writeAuditLog({
    actorId: userId,
    action: 'ai_system.archived',
    entityType: 'ai_system',
    entityId: id,
    summary: `Archived AI system "${existing.name}"`,
  });

  return system;
}

/** Portfolio summary used by the dashboard and maturity score (Tier 3). */
export async function getInventorySummary(userId: string) {
  const systems = await listAiSystems(userId);
  const now = Date.now();
  const byRisk = { high: 0, moderate: 0, low: 0 } as Record<RiskCategory, number>;
  let reviewOverdue = 0;
  let neverReviewed = 0;
  let pendingApproval = 0;

  for (const s of systems) {
    byRisk[s.riskCategory as RiskCategory] = (byRisk[s.riskCategory as RiskCategory] ?? 0) + 1;
    if (!s.lastReviewedAt) neverReviewed += 1;
    if (s.nextReviewAt && s.nextReviewAt.getTime() < now) reviewOverdue += 1;
    if (s.approvalStatus === 'pending') pendingApproval += 1;
  }

  return { total: systems.length, byRisk, reviewOverdue, neverReviewed, pendingApproval };
}
