/**
 * The gate state machine.
 *
 * Gate status is derived, never hand-set: it is recomputed from the underlying
 * facts (register fields, evaluation runs, remediation tasks, approval record)
 * and then persisted so the board can be read cheaply and so each transition
 * leaves an audit trail. The one exception is a waiver, which is an explicit
 * human override and is preserved across recomputation.
 */

import { prisma } from '../prisma';
import { writeAuditLog } from '../audit';
import {
  GATE_SPECS,
  requiresApproval,
  riskSeverity,
  type GateNumber,
  type GateStatus,
} from './gateEnums';

export interface GateEvaluation {
  gate: GateNumber;
  status: GateStatus;
  summary: string;
  blockers: string[];
}

type SystemRow = {
  id: string;
  userId: string;
  organizationId: string | null;
  name: string;
  entityKind: string;
  purpose: string | null;
  businessOwner: string | null;
  riskCategory: string;
  dataTypes: string[];
  approvalStatus: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
};

const SYSTEM_SELECT = {
  id: true,
  userId: true,
  organizationId: true,
  name: true,
  entityKind: true,
  purpose: true,
  businessOwner: true,
  riskCategory: true,
  dataTypes: true,
  approvalStatus: true,
  approvedByName: true,
  approvedAt: true,
} as const;

// ─── Gate 1 — Intake & Risk Tiering ─────────────────────────────────────────

export function evaluateGate1(system: SystemRow): GateEvaluation {
  const blockers: string[] = [];
  if (!system.purpose?.trim()) blockers.push('Purpose has not been described.');
  if (!system.businessOwner?.trim()) blockers.push('No business owner is named.');
  if (!system.riskCategory) blockers.push('No risk tier has been assigned.');
  if (system.dataTypes.length === 0) {
    blockers.push('No data types have been declared.');
  }

  if (blockers.length > 0) {
    return {
      gate: 1,
      status: 'in-progress',
      summary: `Intake is incomplete for this ${system.entityKind}: ${blockers.length} item(s) outstanding.`,
      blockers,
    };
  }

  return {
    gate: 1,
    status: 'passed',
    summary: `Intake complete. Tiered ${system.riskCategory} (${riskSeverity(
      system.riskCategory,
    )} severity), owned by ${system.businessOwner}.`,
    blockers: [],
  };
}

// ─── Gate 2 — Evaluation & Review ───────────────────────────────────────────

interface RunSummary {
  id: string;
  runLabel: string;
  status: string;
  overallVerdict: string | null;
  reviewedAt: Date | null;
  coverageRatio: number | null;
}

export function evaluateGate2(system: SystemRow, runs: RunSummary[], gate1Passed: boolean): GateEvaluation {
  if (!gate1Passed) {
    return {
      gate: 2,
      status: 'not-started',
      summary: 'Blocked: intake and risk tiering must clear before evaluation evidence is reviewed.',
      blockers: ['Gate 1 has not passed.'],
    };
  }

  if (runs.length === 0) {
    return {
      gate: 2,
      status: 'not-started',
      summary: 'No evaluation evidence has been collected yet.',
      blockers: ['No evaluation run has been ingested.'],
    };
  }

  const reviewed = runs.filter((r) => r.status === 'reviewed' && r.overallVerdict);
  if (reviewed.length === 0) {
    return {
      gate: 2,
      status: 'in-progress',
      summary: `${runs.length} evaluation run(s) ingested, awaiting review against the core evaluation parameters.`,
      blockers: ['No evidence report has been produced yet.'],
    };
  }

  // The most recently reviewed run is the one that counts — evidence goes stale.
  const latest = reviewed.reduce((a, b) =>
    (a.reviewedAt?.getTime() ?? 0) >= (b.reviewedAt?.getTime() ?? 0) ? a : b,
  );

  if (latest.overallVerdict === 'fail') {
    return {
      gate: 2,
      status: 'failed',
      summary: `Evidence report for "${latest.runLabel}" returned a fail against the core evaluation parameters.`,
      blockers: ['Latest evidence report failed. Remediate and re-evaluate.'],
    };
  }

  if (latest.overallVerdict === 'conditional-pass') {
    return {
      gate: 2,
      status: 'passed',
      summary: `Conditional pass on "${latest.runLabel}". Proceeding to approval with remediation outstanding.`,
      blockers: [],
    };
  }

  return {
    gate: 2,
    status: 'passed',
    summary: `Evidence report for "${latest.runLabel}" met the core evaluation baselines.`,
    blockers: [],
  };
}

// ─── Gate 3 — Approval & Registry ───────────────────────────────────────────

export function evaluateGate3(
  system: SystemRow,
  gate2Passed: boolean,
  openRemediationCount: number,
): GateEvaluation {
  if (!requiresApproval(system.riskCategory)) {
    return {
      gate: 3,
      status: 'passed',
      summary: `No approval decision required: ${system.riskCategory} risk sits below the medium-risk approval threshold.`,
      blockers: [],
    };
  }

  const blockers: string[] = [];
  if (!gate2Passed) blockers.push('Gate 2 has not passed.');
  if (openRemediationCount > 0) {
    blockers.push(
      `${openRemediationCount} remediation task(s) still open. Approval is recorded only after remediation completes.`,
    );
  }

  if (system.approvalStatus === 'rejected') {
    return {
      gate: 3,
      status: 'failed',
      summary: `Rejected${system.approvedByName ? ` by ${system.approvedByName}` : ''}.`,
      blockers: ['Approval was rejected. Address the decision note and resubmit.'],
    };
  }

  if (system.approvalStatus === 'approved') {
    return {
      gate: 3,
      status: 'passed',
      summary: `Approved${system.approvedByName ? ` by ${system.approvedByName}` : ''}${
        system.approvedAt ? ` on ${system.approvedAt.toISOString().slice(0, 10)}` : ''
      }.`,
      blockers: [],
    };
  }

  if (blockers.length > 0) {
    return {
      gate: 3,
      status: 'not-started',
      summary: 'Not yet eligible for an approval decision.',
      blockers,
    };
  }

  return {
    gate: 3,
    status: 'in-progress',
    summary: 'Eligible for approval. Awaiting a decision from an approver.',
    blockers: [],
  };
}

// ─── Recomputation & persistence ────────────────────────────────────────────

/**
 * Recompute all three gates for one entity and persist the result.
 * Idempotent — safe to call after any change that could move a gate.
 */
export async function refreshGates(aiSystemId: string, actorId?: string): Promise<GateEvaluation[]> {
  const system = await prisma.aiSystem.findUnique({
    where: { id: aiSystemId },
    select: SYSTEM_SELECT,
  });
  if (!system) return [];

  const [runs, openRemediationCount, existing] = await Promise.all([
    prisma.evaluationRun.findMany({
      where: { aiSystemId },
      select: { id: true, runLabel: true, status: true, overallVerdict: true, reviewedAt: true, coverageRatio: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.remediationTask.count({ where: { aiSystemId, status: { not: 'done' } } }),
    prisma.gateRecord.findMany({ where: { aiSystemId } }),
  ]);

  const g1 = evaluateGate1(system);
  const g2 = evaluateGate2(system, runs, g1.status === 'passed');
  const g3 = evaluateGate3(system, g2.status === 'passed', openRemediationCount);
  const evaluations = [g1, g2, g3];

  const byGate = new Map(existing.map((r) => [r.gate, r]));

  for (const evaluation of evaluations) {
    const prior = byGate.get(evaluation.gate);

    // A waiver is a deliberate human override; recomputation must not undo it.
    if (prior?.status === 'waived') continue;

    if (
      prior &&
      prior.status === evaluation.status &&
      prior.summary === evaluation.summary &&
      prior.blockers.join('|') === evaluation.blockers.join('|')
    ) {
      continue;
    }

    await prisma.gateRecord.upsert({
      where: { aiSystemId_gate: { aiSystemId, gate: evaluation.gate } },
      create: {
        aiSystemId,
        userId: system.userId,
        organizationId: system.organizationId,
        gate: evaluation.gate,
        status: evaluation.status,
        summary: evaluation.summary,
        blockers: evaluation.blockers,
        decidedAt: evaluation.status === 'passed' ? new Date() : null,
      },
      update: {
        status: evaluation.status,
        summary: evaluation.summary,
        blockers: evaluation.blockers,
        decidedAt: evaluation.status === 'passed' ? (prior?.decidedAt ?? new Date()) : null,
      },
    });

    // Only a change of status is worth an audit entry; summary churn is noise.
    if (prior && prior.status !== evaluation.status) {
      writeAuditLog({
        actorId: actorId ?? system.userId,
        organizationId: system.organizationId,
        action: 'gate.status_changed',
        entityType: 'gate',
        entityId: aiSystemId,
        summary: `Gate ${evaluation.gate} (${GATE_SPECS[evaluation.gate].name}) moved ${prior.status} → ${evaluation.status} for "${system.name}"`,
        metadata: { gate: evaluation.gate, from: prior.status, to: evaluation.status },
      });
    }
  }

  return evaluations;
}

/** Create the three gate rows for a newly registered entity. */
export async function initializeGates(aiSystemId: string, actorId?: string): Promise<void> {
  await refreshGates(aiSystemId, actorId);
}

export async function getGateRecords(aiSystemId: string) {
  return prisma.gateRecord.findMany({ where: { aiSystemId }, orderBy: { gate: 'asc' } });
}

/**
 * Explicit human override for a gate that cannot pass on its evidence but that
 * an accountable owner has decided to accept. Always audited.
 */
export async function waiveGate(params: {
  aiSystemId: string;
  gate: GateNumber;
  actorId: string;
  actorName?: string | null;
  organizationId?: string | null;
  justification: string;
}) {
  const record = await prisma.gateRecord.upsert({
    where: { aiSystemId_gate: { aiSystemId: params.aiSystemId, gate: params.gate } },
    create: {
      aiSystemId: params.aiSystemId,
      userId: params.actorId,
      organizationId: params.organizationId ?? null,
      gate: params.gate,
      status: 'waived',
      summary: params.justification,
      blockers: [],
      decidedById: params.actorId,
      decidedByName: params.actorName ?? null,
      decidedAt: new Date(),
    },
    update: {
      status: 'waived',
      summary: params.justification,
      blockers: [],
      decidedById: params.actorId,
      decidedByName: params.actorName ?? null,
      decidedAt: new Date(),
    },
  });

  writeAuditLog({
    actorId: params.actorId,
    organizationId: params.organizationId,
    action: 'gate.waived',
    entityType: 'gate',
    entityId: params.aiSystemId,
    summary: `Gate ${params.gate} (${GATE_SPECS[params.gate].name}) waived: ${params.justification}`,
    metadata: { gate: params.gate },
  });

  return record;
}

// ─── Board view ─────────────────────────────────────────────────────────────

export interface GateBoardEntry {
  id: string;
  name: string;
  entityKind: string;
  riskCategory: string;
  lifecycleStage: string;
  approvalStatus: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  /** The gate the entity is currently sitting at (1–3), or 4 once all have passed. */
  currentGate: number;
  gates: { gate: number; status: string; summary: string | null; blockers: string[] }[];
  openRemediation: number;
  latestRunVerdict: string | null;
}

/**
 * The pipeline view: every active entity with its gate posture, in one query
 * pass rather than N+1 per entity.
 */
export async function getGateBoard(userId: string): Promise<GateBoardEntry[]> {
  const systems = await prisma.aiSystem.findMany({
    where: { userId, status: 'active' },
    orderBy: [{ riskCategory: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      entityKind: true,
      riskCategory: true,
      lifecycleStage: true,
      approvalStatus: true,
      approvedByName: true,
      approvedAt: true,
      gateRecords: { select: { gate: true, status: true, summary: true, blockers: true }, orderBy: { gate: 'asc' } },
    },
  });
  if (systems.length === 0) return [];

  const ids = systems.map((s) => s.id);
  const [openTasks, latestRuns] = await Promise.all([
    prisma.remediationTask.groupBy({
      by: ['aiSystemId'],
      where: { aiSystemId: { in: ids }, status: { not: 'done' } },
      _count: { _all: true },
    }),
    prisma.evaluationRun.findMany({
      where: { aiSystemId: { in: ids }, status: 'reviewed' },
      select: { aiSystemId: true, overallVerdict: true, reviewedAt: true },
      orderBy: { reviewedAt: 'desc' },
    }),
  ]);

  const openBySystem = new Map(openTasks.map((t) => [t.aiSystemId, t._count._all]));
  const verdictBySystem = new Map<string, string | null>();
  for (const run of latestRuns) {
    if (!verdictBySystem.has(run.aiSystemId)) verdictBySystem.set(run.aiSystemId, run.overallVerdict);
  }

  return systems.map((s) => {
    const gates = s.gateRecords.map((g) => ({
      gate: g.gate,
      status: g.status,
      summary: g.summary,
      blockers: g.blockers,
    }));
    const passed = (gate: number) => {
      const record = gates.find((g) => g.gate === gate);
      return record?.status === 'passed' || record?.status === 'waived';
    };
    const currentGate = !passed(1) ? 1 : !passed(2) ? 2 : !passed(3) ? 3 : 4;

    return {
      id: s.id,
      name: s.name,
      entityKind: s.entityKind,
      riskCategory: s.riskCategory,
      lifecycleStage: s.lifecycleStage,
      approvalStatus: s.approvalStatus,
      approvedByName: s.approvedByName,
      approvedAt: s.approvedAt?.toISOString() ?? null,
      currentGate,
      gates,
      openRemediation: openBySystem.get(s.id) ?? 0,
      latestRunVerdict: verdictBySystem.get(s.id) ?? null,
    };
  });
}

/** Portfolio counts for the gates page header and the dashboard. */
export async function getGateSummary(userId: string) {
  const board = await getGateBoard(userId);
  const summary = {
    total: board.length,
    atGate1: 0,
    atGate2: 0,
    atGate3: 0,
    cleared: 0,
    blocked: 0,
    awaitingApproval: 0,
    byKind: { 'use-case': 0, agent: 0, model: 0 } as Record<string, number>,
  };

  for (const entry of board) {
    if (entry.currentGate === 1) summary.atGate1 += 1;
    else if (entry.currentGate === 2) summary.atGate2 += 1;
    else if (entry.currentGate === 3) summary.atGate3 += 1;
    else summary.cleared += 1;

    if (entry.gates.some((g) => g.status === 'failed')) summary.blocked += 1;
    if (entry.approvalStatus === 'pending') summary.awaitingApproval += 1;
    summary.byKind[entry.entityKind] = (summary.byKind[entry.entityKind] ?? 0) + 1;
  }

  return summary;
}
