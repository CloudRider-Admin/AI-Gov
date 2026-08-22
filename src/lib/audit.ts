import { prisma } from './prisma';

/**
 * The governance audit trail (Tier 1d).
 *
 * Append-only by convention: nothing in the application updates or deletes an
 * entry, and the cleanup cron deliberately leaves this table alone.
 */

export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditWrite {
  actorId: string;
  organizationId?: string | null;
  action: string;      // e.g. "ai_system.created"
  entityType: string;  // e.g. "ai_system"
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  /** NIST 800-53 AU-3: where the action came from, and how it ended. */
  actorIp?: string | null;
  actorUserAgent?: string | null;
  outcome?: AuditOutcome;
}

/**
 * Append an entry to the governance audit trail.
 *
 * Audit logging must never break the user-facing action, so a write failure is
 * swallowed here rather than thrown. It is not swallowed silently: the failure
 * is surfaced through `onAuditFailure` so an operator can alarm on it, because
 * a trail that stops recording without anyone noticing is the failure mode
 * AU-5 exists to prevent.
 */
export async function writeAuditLog(params: AuditWrite): Promise<void> {
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
        actorIp: params.actorIp ?? null,
        actorUserAgent: params.actorUserAgent ?? null,
        outcome: params.outcome ?? 'success',
      },
    });
  } catch (err) {
    reportAuditFailure(params, err);
  }
}

type AuditFailureHandler = (params: AuditWrite, error: unknown) => void;

let auditFailureHandler: AuditFailureHandler = (params, error) => {
  // Structured so a log drain can alert on `audit.write_failed` specifically.
  console.error(
    JSON.stringify({
      event: 'audit.write_failed',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      actorId: params.actorId,
      error: error instanceof Error ? error.message : String(error),
      at: new Date().toISOString(),
    }),
  );
};

/** Route audit-write failures somewhere that pages a human. */
export function onAuditFailure(handler: AuditFailureHandler): void {
  auditFailureHandler = handler;
}

function reportAuditFailure(params: AuditWrite, error: unknown): void {
  try {
    auditFailureHandler(params, error);
  } catch {
    // A failing failure handler must not take down the request either.
  }
}

// ─── Reading the trail ───────────────────────────────────────────────────────

export interface AuditQuery {
  /** When set, the whole organization's trail. Otherwise a single actor's. */
  organizationId?: string | null;
  actorId?: string;
  /** Exact action match, e.g. "ai_system.approved". */
  action?: string;
  entityType?: string;
  entityId?: string;
  outcome?: AuditOutcome;
  from?: Date;
  to?: Date;
  /** Substring match against the human-readable summary. */
  search?: string;
}

export const AUDIT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

function buildWhere(filter: AuditQuery) {
  const createdAt =
    filter.from || filter.to
      ? { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) }
      : undefined;

  return {
    ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.entityId ? { entityId: filter.entityId } : {}),
    ...(filter.outcome ? { outcome: filter.outcome } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(filter.search
      ? { summary: { contains: filter.search, mode: 'insensitive' as const } }
      : {}),
  };
}

export interface AuditPage {
  entries: Awaited<ReturnType<typeof prisma.auditLogEntry.findMany>>;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * One page of the trail, newest first, with the total so the view can page
 * through rather than silently truncating at a fixed ceiling.
 */
export async function getAuditPage(
  filter: AuditQuery,
  page = 1,
  pageSize = AUDIT_PAGE_SIZE,
): Promise<AuditPage> {
  const size = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const current = Math.max(page, 1);
  const where = buildWhere(filter);

  const [entries, total] = await Promise.all([
    prisma.auditLogEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (current - 1) * size,
      take: size,
    }),
    prisma.auditLogEntry.count({ where }),
  ]);

  return {
    entries,
    total,
    page: current,
    pageSize: size,
    pageCount: Math.max(Math.ceil(total / size), 1),
  };
}

/**
 * The full filtered trail as rows, for export. Capped high rather than
 * unbounded — an export that hangs the database serves nobody.
 */
export const AUDIT_EXPORT_LIMIT = 10_000;

export async function getAuditForExport(filter: AuditQuery) {
  return prisma.auditLogEntry.findMany({
    where: buildWhere(filter),
    orderBy: { createdAt: 'asc' },
    take: AUDIT_EXPORT_LIMIT,
  });
}

/** The distinct actions present in a trail, so the filter can offer real options. */
export async function getAuditActions(filter: Pick<AuditQuery, 'organizationId' | 'actorId'>) {
  const rows = await prisma.auditLogEntry.groupBy({
    by: ['action'],
    where: buildWhere(filter),
    _count: { _all: true },
    orderBy: { _count: { action: 'desc' } },
  });
  return rows.map((r) => ({ action: r.action, count: r._count._all }));
}

/**
 * Backwards-compatible single-page read.
 * @deprecated Use `getAuditPage`, which reports the total and pages properly.
 */
export async function getAuditLog(
  filter: { organizationId?: string | null; actorId?: string },
  limit = 100,
) {
  return prisma.auditLogEntry.findMany({
    where: buildWhere(filter),
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, MAX_PAGE_SIZE),
  });
}
