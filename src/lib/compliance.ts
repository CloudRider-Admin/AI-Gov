import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { FRAMEWORKS, getFramework, type Framework } from './complianceFrameworks';
import { ASSESSMENT_STATUSES, type AssessmentStatus } from './governanceEnums';

export { ASSESSMENT_STATUSES };
export type { AssessmentStatus };

export interface ControlWithStatus {
  id: string;
  title: string;
  category: string;
  description: string;
  status: AssessmentStatus;
  evidence: string | null;
  updatedAt: string | null;
}

export interface FrameworkPosture {
  id: string;
  name: string;
  authority: string;
  coverage: number; // 0–100, share of applicable controls implemented
  counts: Record<AssessmentStatus, number>;
  controls: ControlWithStatus[];
}

/** Merge the static catalog with the user's stored assessment status. */
export async function getFrameworkPosture(userId: string, frameworkId: string): Promise<FrameworkPosture | null> {
  const framework = getFramework(frameworkId);
  if (!framework) return null;

  const rows = await prisma.controlAssessment.findMany({
    where: { userId, framework: frameworkId },
  });
  const byControl = new Map(rows.map((r) => [r.controlId, r]));

  return buildPosture(framework, byControl);
}

export async function getAllPostures(userId: string): Promise<FrameworkPosture[]> {
  const rows = await prisma.controlAssessment.findMany({ where: { userId } });
  const byKey = new Map(rows.map((r) => [`${r.framework}:${r.controlId}`, r]));

  return FRAMEWORKS.map((framework) => {
    const scoped = new Map(
      framework.controls
        .map((c) => [c.id, byKey.get(`${framework.id}:${c.id}`)] as const)
        .filter((pair): pair is [string, NonNullable<typeof pair[1]>] => Boolean(pair[1])),
    );
    return buildPosture(framework, scoped);
  });
}

type AssessmentRow = { status: string; evidence: string | null; updatedAt: Date };

function buildPosture(framework: Framework, byControl: Map<string, AssessmentRow>): FrameworkPosture {
  const counts: Record<AssessmentStatus, number> = {
    'not-started': 0,
    'in-progress': 0,
    implemented: 0,
    'not-applicable': 0,
  };

  const controls: ControlWithStatus[] = framework.controls.map((c) => {
    const row = byControl.get(c.id);
    const status = (row?.status as AssessmentStatus) ?? 'not-started';
    counts[status] += 1;
    return {
      id: c.id,
      title: c.title,
      category: c.category,
      description: c.description,
      status,
      evidence: row?.evidence ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });

  const applicable = framework.controls.length - counts['not-applicable'];
  const coverage = applicable > 0 ? Math.round((counts.implemented / applicable) * 100) : 100;

  return {
    id: framework.id,
    name: framework.name,
    authority: framework.authority,
    coverage,
    counts,
    controls,
  };
}

export async function setAssessment(
  userId: string,
  frameworkId: string,
  controlId: string,
  status: AssessmentStatus,
  evidence?: string | null,
) {
  const framework = getFramework(frameworkId);
  if (!framework || !framework.controls.some((c) => c.id === controlId)) return null;

  const row = await prisma.controlAssessment.upsert({
    where: { userId_framework_controlId: { userId, framework: frameworkId, controlId } },
    create: { userId, framework: frameworkId, controlId, status, evidence: evidence ?? null, updatedBy: userId },
    update: { status, evidence: evidence ?? null, updatedBy: userId },
  });

  writeAuditLog({
    actorId: userId,
    action: 'control.updated',
    entityType: 'control',
    entityId: `${frameworkId}:${controlId}`,
    summary: `Set ${frameworkId} ${controlId} to "${status}"`,
  });

  return row;
}

/** Average coverage across frameworks — feeds the maturity score (Tier 3). */
export async function getComplianceSummary(userId: string) {
  const postures = await getAllPostures(userId);
  const avg = postures.length
    ? Math.round(postures.reduce((sum, p) => sum + p.coverage, 0) / postures.length)
    : 0;
  return { averageCoverage: avg, frameworks: postures.map((p) => ({ id: p.id, coverage: p.coverage })) };
}
