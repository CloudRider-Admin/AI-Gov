import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Admin-scope governance aggregates.
 *
 * Deliberately separate from `/api/admin/overview`, which reports infrastructure
 * health (latency, error rate, embedding coverage). This route reports on the
 * governance estate itself — the product's actual content — across all tenants.
 * Everything here is a `groupBy` or `_count` rather than a fetch-then-filter,
 * because unlike the per-user dashboard these queries span every row in the table.
 */

export interface EstateRollup {
  total: number;
  archived: number;
  byRisk: Record<string, number>;
  byStage: Record<string, number>;
  byKind: Record<string, number>;
  awaitingApproval: number;
  overdueReview: number;
}

export interface GateAgingRow {
  systemId: string;
  systemName: string;
  gate: number;
  status: string;
  daysInGate: number;
  blockers: string[];
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  members: number;
  systems: number;
  lastSystemActivityAt: string | null;
}

export interface IngestHealth {
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  tokensActive: number;
  tokensRevoked: number;
  lastIngestAt: string | null;
}

export interface AdvisorQuality {
  total: number;
  confirmed: number;
  corrected: number;
  accuracyPct: number;
  topCorrections: Array<{ from: string; to: string; count: number }>;
}

export interface WorkflowsInFlight {
  byStatus: Record<string, number>;
  /** Open sessions untouched for 7+ days — the ones that will never finish on their own. */
  stale: Array<{
    id: string;
    workflowType: string;
    currentStep: number;
    totalSteps: number;
    updatedAt: string;
  }>;
}

export interface AdminGovernancePayload {
  generatedAt: string;
  estate: EstateRollup;
  gateAging: GateAgingRow[];
  tenants: TenantRow[];
  ingest: IngestHealth;
  advisor: AdvisorQuality;
  workflows: WorkflowsInFlight;
}

/** Fold a Prisma groupBy result into a plain count map. */
function tally<K extends string>(
  rows: Array<Record<string, unknown> & { _count: number }>,
  key: K,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = row[key];
    if (typeof value === 'string') out[value] = row._count;
  }
  return out;
}

export async function GET() {
  const session = await getOptionalSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [
      riskGroups,
      stageGroups,
      kindGroups,
      totalActive,
      archived,
      awaitingApproval,
      overdueReview,
      openGates,
      organizations,
      systemsByOrg,
      runSourceGroups,
      runStatusGroups,
      latestRun,
      tokensActive,
      tokensRevoked,
      feedbackTotal,
      feedbackConfirmed,
      correctionGroups,
      workflowGroups,
      staleWorkflows,
    ] = await Promise.all([
      prisma.aiSystem.groupBy({ by: ['riskCategory'], where: { status: 'active' }, _count: true }),
      prisma.aiSystem.groupBy({ by: ['lifecycleStage'], where: { status: 'active' }, _count: true }),
      prisma.aiSystem.groupBy({ by: ['entityKind'], where: { status: 'active' }, _count: true }),
      prisma.aiSystem.count({ where: { status: 'active' } }),
      prisma.aiSystem.count({ where: { status: 'archived' } }),
      prisma.aiSystem.count({ where: { status: 'active', approvalStatus: 'pending' } }),
      prisma.aiSystem.count({
        where: { status: 'active', nextReviewAt: { lt: now } },
      }),

      // Gates sitting open — the admin SLA view. Ordered oldest-first so the
      // worst offenders surface without paging.
      prisma.gateRecord.findMany({
        where: { status: { in: ['in-progress', 'failed'] } },
        orderBy: { updatedAt: 'asc' },
        take: 12,
        select: {
          gate: true,
          status: true,
          blockers: true,
          updatedAt: true,
          aiSystemId: true,
          aiSystem: { select: { name: true } },
        },
      }),

      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          _count: { select: { members: true } },
        },
      }),

      // AiSystem has no FK relation to Organization, so counts come from a
      // separate groupBy keyed on the nullable organizationId column.
      prisma.aiSystem.groupBy({
        by: ['organizationId'],
        where: { status: 'active', organizationId: { not: null } },
        _count: true,
        _max: { updatedAt: true },
      }),

      prisma.evaluationRun.groupBy({ by: ['source'], _count: true }),
      prisma.evaluationRun.groupBy({ by: ['status'], _count: true }),
      prisma.evaluationRun.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.ingestToken.count({ where: { revokedAt: null } }),
      prisma.ingestToken.count({ where: { revokedAt: { not: null } } }),

      prisma.intentFeedback.count(),
      prisma.intentFeedback.count({ where: { correctedIntent: null } }),
      prisma.intentFeedback.groupBy({
        by: ['detectedIntent', 'correctedIntent'],
        where: { correctedIntent: { not: null } },
        _count: true,
      }),

      prisma.workflowSession.groupBy({ by: ['status'], _count: true }),
      prisma.workflowSession.findMany({
        where: { status: { in: ['in-progress', 'paused'] }, updatedAt: { lt: sevenDaysAgo } },
        orderBy: { updatedAt: 'asc' },
        take: 8,
        select: {
          id: true,
          workflowType: true,
          currentStep: true,
          totalSteps: true,
          updatedAt: true,
        },
      }),
    ]);

    const estate: EstateRollup = {
      total: totalActive,
      archived,
      byRisk: tally(riskGroups, 'riskCategory'),
      byStage: tally(stageGroups, 'lifecycleStage'),
      byKind: tally(kindGroups, 'entityKind'),
      awaitingApproval,
      overdueReview,
    };

    const gateAging: GateAgingRow[] = openGates.map((g) => ({
      systemId: g.aiSystemId,
      systemName: g.aiSystem.name,
      gate: g.gate,
      status: g.status,
      daysInGate: Math.max(
        0,
        Math.floor((now.getTime() - g.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
      ),
      blockers: g.blockers,
    }));

    const systemCountByOrg = new Map(
      systemsByOrg.map((r) => [r.organizationId, { count: r._count, lastAt: r._max.updatedAt }]),
    );
    const tenants: TenantRow[] = organizations.map((o) => {
      const stats = systemCountByOrg.get(o.id);
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        members: o._count.members,
        systems: stats?.count ?? 0,
        lastSystemActivityAt: stats?.lastAt?.toISOString() ?? null,
      };
    });

    const ingest: IngestHealth = {
      bySource: tally(runSourceGroups, 'source'),
      byStatus: tally(runStatusGroups, 'status'),
      tokensActive,
      tokensRevoked,
      lastIngestAt: latestRun?.createdAt.toISOString() ?? null,
    };

    const corrected = feedbackTotal - feedbackConfirmed;
    const advisor: AdvisorQuality = {
      total: feedbackTotal,
      confirmed: feedbackConfirmed,
      corrected,
      accuracyPct: feedbackTotal > 0 ? Math.round((feedbackConfirmed / feedbackTotal) * 100) : 0,
      topCorrections: correctionGroups
        .map((c) => ({
          from: c.detectedIntent,
          to: c.correctedIntent ?? 'unknown',
          count: c._count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };

    const workflows: WorkflowsInFlight = {
      byStatus: tally(workflowGroups, 'status'),
      stale: staleWorkflows.map((w) => ({
        id: w.id,
        workflowType: w.workflowType,
        currentStep: w.currentStep,
        totalSteps: w.totalSteps,
        updatedAt: w.updatedAt.toISOString(),
      })),
    };

    const payload: AdminGovernancePayload = {
      generatedAt: now.toISOString(),
      estate,
      gateAging,
      tenants,
      ingest,
      advisor,
      workflows,
    };

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[admin/governance] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch governance rollup' }, { status: 500 });
  }
}
