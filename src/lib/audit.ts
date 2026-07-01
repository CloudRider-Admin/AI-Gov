import { prisma } from './prisma';

/**
 * Append an immutable entry to the governance audit trail (Tier 1d).
 * Fire-and-forget: audit logging must never break the user-facing action, so
 * failures are swallowed and logged rather than thrown.
 */
export async function writeAuditLog(params: {
  actorId: string;
  organizationId?: string | null;
  action: string;      // e.g. "ai_system.created"
  entityType: string;  // e.g. "ai_system"
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLogEntry.create({
      data: {
        actorId: params.actorId,
        organizationId: params.organizationId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        summary: params.summary,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

export async function getAuditLog(
  filter: { organizationId?: string | null; actorId?: string },
  limit = 100,
) {
  return prisma.auditLogEntry.findMany({
    where: {
      ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
  });
}
