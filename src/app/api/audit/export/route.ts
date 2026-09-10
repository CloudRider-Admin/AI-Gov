import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import {
  getAuditForExport,
  writeAuditLog,
  AUDIT_EXPORT_LIMIT,
  type AuditQuery,
  type AuditOutcome,
} from '@/lib/audit';

const OUTCOMES: AuditOutcome[] = ['success', 'failure', 'denied'];
const RANGE_DAYS: Record<string, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null };

const COLUMNS = [
  'timestamp',
  'action',
  'outcome',
  'entity_type',
  'entity_id',
  'actor_id',
  'actor_ip',
  'user_agent',
  'summary',
  'metadata',
] as const;

/**
 * Escape one CSV field.
 *
 * The leading-character guard is deliberate: a summary beginning with =, +, -,
 * or @ is interpreted as a formula when the export is opened in Excel, which
 * turns an audit record into executable content. Prefixing with a single quote
 * neutralizes it without altering the value a reader sees.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * GET /api/audit/export — the filtered trail as CSV.
 *
 * Scoped exactly like the /audit view: the caller's organization when they
 * belong to one, their own actions otherwise. Exporting the trail is itself an
 * auditable act, so it is recorded on the trail.
 */
export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
    orderBy: { joinedAt: 'asc' },
  });

  const search = request.nextUrl.searchParams;
  const rangeKey = search.get('range') ?? '30d';
  const days = rangeKey in RANGE_DAYS ? RANGE_DAYS[rangeKey] : 30;
  const outcomeParam = search.get('outcome');

  const filter: AuditQuery = {
    ...(membership ? { organizationId: membership.organizationId } : { actorId: session.user.id }),
    action: search.get('action') || undefined,
    outcome: OUTCOMES.includes(outcomeParam as AuditOutcome)
      ? (outcomeParam as AuditOutcome)
      : undefined,
    search: search.get('q') || undefined,
    from: days ? new Date(Date.now() - days * 86_400_000) : undefined,
  };

  const entries = await getAuditForExport(filter);

  const rows = entries.map((e) =>
    [
      e.createdAt,
      e.action,
      e.outcome,
      e.entityType,
      e.entityId,
      e.actorId,
      e.actorIp,
      e.actorUserAgent,
      e.summary,
      e.metadata,
    ]
      .map(csvField)
      .join(','),
  );

  const csv = [COLUMNS.join(','), ...rows].join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);

  await writeAuditLog({
    actorId: session.user.id,
    organizationId: membership?.organizationId ?? null,
    action: 'audit.exported',
    entityType: 'audit_log',
    summary: `Exported ${entries.length} audit record(s) as CSV${
      filter.action ? ` filtered to "${filter.action}"` : ''
    }.`,
    metadata: {
      rows: entries.length,
      truncated: entries.length >= AUDIT_EXPORT_LIMIT,
      range: rangeKey,
      action: filter.action ?? null,
      outcome: filter.outcome ?? null,
    },
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="govsecure-audit-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
