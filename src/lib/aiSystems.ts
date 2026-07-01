import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { RISK_CATEGORIES, LIFECYCLE_STAGES, type RiskCategory, type LifecycleStage } from './governanceEnums';

export { RISK_CATEGORIES, LIFECYCLE_STAGES };
export type { RiskCategory, LifecycleStage };

export interface AiSystemInput {
  name: string;
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
  const system = await prisma.aiSystem.create({
    data: {
      userId,
      name: input.name.trim(),
      description: input.description ?? null,
      purpose: input.purpose ?? null,
      businessOwner: input.businessOwner ?? null,
      vendor: input.vendor ?? null,
      model: input.model ?? null,
      lifecycleStage: input.lifecycleStage ?? 'idea',
      riskCategory: input.riskCategory ?? 'limited',
      dataTypes: input.dataTypes ?? [],
      deployedAt: parseDate(input.deployedAt),
      nextReviewAt: parseDate(input.nextReviewAt),
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'ai_system.created',
    entityType: 'ai_system',
    entityId: system.id,
    summary: `Registered AI system "${system.name}" (${system.riskCategory} risk)`,
  });

  return system;
}

export async function updateAiSystem(userId: string, id: string, input: Partial<AiSystemInput>) {
  const existing = await getAiSystem(userId, id);
  if (!existing) return null;

  const system = await prisma.aiSystem.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
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
    summary: `Updated AI system "${system.name}"`,
  });

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
  let reviewOverdue = 0;
  let neverReviewed = 0;

  for (const s of systems) {
    byRisk[s.riskCategory as RiskCategory] = (byRisk[s.riskCategory as RiskCategory] ?? 0) + 1;
    if (!s.lastReviewedAt) neverReviewed += 1;
    if (s.nextReviewAt && s.nextReviewAt.getTime() < now) reviewOverdue += 1;
  }

  return { total: systems.length, byRisk, reviewOverdue, neverReviewed };
}
