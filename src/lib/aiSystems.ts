import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { RISK_CATEGORIES, LIFECYCLE_STAGES, type RiskCategory, type LifecycleStage } from './governanceEnums';
import { ENTITY_KINDS, requiresApproval, type EntityKind } from './gates/gateEnums';
import { initializeGates, refreshGates } from './gates/gates';
import { reconcileApprovalForRisk } from './gates/approvals';

export { RISK_CATEGORIES, LIFECYCLE_STAGES, ENTITY_KINDS };
export type { RiskCategory, LifecycleStage, EntityKind };

export interface AiSystemInput {
  name: string;
  entityKind?: EntityKind;
  description?: string | null;
  purpose?: string | null;
  businessOwner?: string | null;
  vendor?: string | null;
  model?: string | null;
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

/**
 * List registered entities visible to a user (personal scope; org scope layered
 * in Tier 2). Pass `entityKind` to narrow to use cases, agents, or models.
 */
export async function listAiSystems(userId: string, entityKind?: EntityKind) {
  return prisma.aiSystem.findMany({
    where: { userId, status: 'active', ...(entityKind ? { entityKind } : {}) },
    orderBy: [{ riskCategory: 'asc' }, { updatedAt: 'desc' }],
    include: {
      gateRecords: { select: { gate: true, status: true }, orderBy: { gate: 'asc' } },
    },
  });
}

export async function getAiSystem(userId: string, id: string) {
  const system = await prisma.aiSystem.findUnique({ where: { id } });
  if (!system || system.userId !== userId) return null;
  return system;
}

export async function createAiSystem(userId: string, input: AiSystemInput) {
  const riskCategory = input.riskCategory ?? 'limited';
  const entityKind = input.entityKind ?? 'use-case';

  const system = await prisma.aiSystem.create({
    data: {
      userId,
      name: input.name.trim(),
      entityKind,
      description: input.description ?? null,
      purpose: input.purpose ?? null,
      businessOwner: input.businessOwner ?? null,
      vendor: input.vendor ?? null,
      model: input.model ?? null,
      lifecycleStage: input.lifecycleStage ?? 'idea',
      riskCategory,
      dataTypes: input.dataTypes ?? [],
      deployedAt: parseDate(input.deployedAt),
      nextReviewAt: parseDate(input.nextReviewAt),
      // Medium risk and above needs a named approval decision at Gate 3;
      // anything below is registered without one.
      approvalStatus: requiresApproval(riskCategory) ? 'pending' : 'not-required',
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'ai_system.created',
    entityType: 'ai_system',
    entityId: system.id,
    summary: `Registered ${entityKind} "${system.name}" (${system.riskCategory} risk)`,
    metadata: { entityKind, riskCategory },
  });

  // Gate 1 is evaluated the moment an entity is registered, so the board never
  // shows an entity with no gate state.
  await initializeGates(system.id, userId);

  return system;
}

export async function updateAiSystem(userId: string, id: string, input: Partial<AiSystemInput>) {
  const existing = await getAiSystem(userId, id);
  if (!existing) return null;

  const system = await prisma.aiSystem.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.entityKind !== undefined ? { entityKind: input.entityKind } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      ...(input.businessOwner !== undefined ? { businessOwner: input.businessOwner } : {}),
      ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.lifecycleStage !== undefined ? { lifecycleStage: input.lifecycleStage } : {}),
      ...(input.riskCategory !== undefined ? { riskCategory: input.riskCategory } : {}),
      ...(input.dataTypes !== undefined ? { dataTypes: input.dataTypes } : {}),
      ...(input.deployedAt !== undefined ? { deployedAt: parseDate(input.deployedAt) } : {}),
      ...(input.nextReviewAt !== undefined ? { nextReviewAt: parseDate(input.nextReviewAt) } : {}),
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'ai_system.updated',
    entityType: 'ai_system',
    entityId: system.id,
    summary: `Updated ${system.entityKind} "${system.name}"`,
  });

  // A change of risk tier can move an entity in or out of the approval
  // requirement, and can invalidate an approval granted under a lighter tier.
  if (input.riskCategory !== undefined && input.riskCategory !== existing.riskCategory) {
    await reconcileApprovalForRisk(id, existing.riskCategory, input.riskCategory, userId);
  }

  // Intake fields feed Gate 1's exit criteria, so any edit can move the gate.
  await refreshGates(id, userId);

  return system;
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
  const byRisk = { prohibited: 0, high: 0, limited: 0, minimal: 0 } as Record<RiskCategory, number>;
  const byKind = { 'use-case': 0, agent: 0, model: 0 } as Record<EntityKind, number>;
  const byApproval = { 'not-required': 0, pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
  let reviewOverdue = 0;
  let neverReviewed = 0;
  let approvalExpired = 0;

  for (const s of systems) {
    byRisk[s.riskCategory as RiskCategory] = (byRisk[s.riskCategory as RiskCategory] ?? 0) + 1;
    byKind[s.entityKind as EntityKind] = (byKind[s.entityKind as EntityKind] ?? 0) + 1;
    byApproval[s.approvalStatus] = (byApproval[s.approvalStatus] ?? 0) + 1;
    if (!s.lastReviewedAt) neverReviewed += 1;
    if (s.nextReviewAt && s.nextReviewAt.getTime() < now) reviewOverdue += 1;
    if (s.approvalStatus === 'approved' && s.approvalExpiresAt && s.approvalExpiresAt.getTime() < now) {
      approvalExpired += 1;
    }
  }

  return {
    total: systems.length,
    byRisk,
    byKind,
    byApproval,
    reviewOverdue,
    neverReviewed,
    approvalExpired,
  };
}
