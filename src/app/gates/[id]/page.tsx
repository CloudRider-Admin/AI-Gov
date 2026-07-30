import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { getGateRecords, refreshGates } from '@/lib/gates/gates';
import { getApprovalEligibility } from '@/lib/gates/approvals';
import { listEvaluationRuns } from '@/lib/gates/evaluations';
import { GateDetailClient } from './GateDetailClient';

export const metadata: Metadata = {
  title: 'Gate detail',
  description: 'Intake, evaluation evidence, and approval for a registered AI entity.',
};

export default async function GateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const system = await prisma.aiSystem.findUnique({ where: { id } });
  if (!system || system.userId !== session.user.id) notFound();

  // Recompute on load so a gate can never present stale state to a decision-maker.
  await refreshGates(id, session.user.id);

  const [gates, runs, approval, openTasks] = await Promise.all([
    getGateRecords(id),
    listEvaluationRuns(session.user.id, id),
    getApprovalEligibility(id),
    prisma.remediationTask.findMany({
      where: { aiSystemId: id, status: { not: 'done' } },
      select: { id: true, title: true, priority: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <GateDetailClient
      system={{
        id: system.id,
        name: system.name,
        entityKind: system.entityKind,
        purpose: system.purpose,
        businessOwner: system.businessOwner,
        vendor: system.vendor,
        riskCategory: system.riskCategory,
        lifecycleStage: system.lifecycleStage,
        dataTypes: system.dataTypes,
        approvalStatus: system.approvalStatus,
        approvedByName: system.approvedByName,
        approvedAt: system.approvedAt?.toISOString() ?? null,
        approvalNote: system.approvalNote,
        approvalExpiresAt: system.approvalExpiresAt?.toISOString() ?? null,
      }}
      gates={gates.map((g) => ({
        gate: g.gate,
        status: g.status,
        summary: g.summary,
        blockers: g.blockers,
        decidedByName: g.decidedByName,
        decidedAt: g.decidedAt?.toISOString() ?? null,
      }))}
      runs={(runs ?? []).map((r) => ({
        id: r.id,
        runLabel: r.runLabel,
        source: r.source,
        evaluatorTeam: r.evaluatorTeam,
        evaluatorName: r.evaluatorName,
        platform: r.platform,
        status: r.status,
        overallVerdict: r.overallVerdict,
        reviewSummary: r.reviewSummary,
        reportMarkdown: r.reportMarkdown,
        coverageRatio: r.coverageRatio,
        evaluatedAt: r.evaluatedAt?.toISOString() ?? null,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        results: r.results.map((res) => ({
          id: res.id,
          area: res.area,
          parameter: res.parameter,
          metricValue: res.metricValue,
          unit: res.unit,
          textValue: res.textValue,
          sampleSize: res.sampleSize,
          verdict: res.verdict,
          severity: res.severity,
          baselineNote: res.baselineNote,
          gap: res.gap,
        })),
      }))}
      approval={approval}
      openTasks={openTasks}
    />
  );
}
