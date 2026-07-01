import { prisma } from './prisma';
import { getInventorySummary } from './aiSystems';
import { getComplianceSummary } from './compliance';
import { getRemediationSummary } from './remediation';

export interface MaturityDimensions {
  inventory: number;   // have you built a register?
  controls: number;    // average control coverage
  reviewCadence: number; // are systems reviewed on schedule?
  remediation: number; // are gaps being closed?
}

export interface MaturityResult {
  score: number; // 0–100 overall
  dimensions: MaturityDimensions;
  nudges: string[]; // proactive, actionable recommendations
}

const WEIGHTS: Record<keyof MaturityDimensions, number> = {
  inventory: 0.25,
  controls: 0.35,
  reviewCadence: 0.2,
  remediation: 0.2,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Compute the current AI governance maturity score from live data (Tier 3). */
export async function computeMaturity(userId: string): Promise<MaturityResult> {
  const [inv, comp, rem] = await Promise.all([
    getInventorySummary(userId),
    getComplianceSummary(userId),
    getRemediationSummary(userId),
  ]);

  // Inventory: 4+ registered systems is considered a mature register.
  const inventory = clamp(Math.min(100, inv.total * 25));

  // Controls: average implemented coverage across frameworks.
  const controls = clamp(comp.averageCoverage);

  // Review cadence: share of systems that are neither overdue nor never-reviewed.
  const onTrack = Math.max(0, inv.total - inv.reviewOverdue - inv.neverReviewed);
  const reviewCadence = inv.total > 0 ? clamp((onTrack / inv.total) * 100) : 0;

  // Remediation: completion rate, penalised for overdue work.
  const closed = rem.done;
  const tracked = rem.done + rem.open;
  const base = tracked > 0 ? (closed / tracked) * 100 : 100;
  const remediation = clamp(base - Math.min(rem.overdue * 10, 30));

  const dimensions: MaturityDimensions = { inventory, controls, reviewCadence, remediation };

  const score = clamp(
    dimensions.inventory * WEIGHTS.inventory +
      dimensions.controls * WEIGHTS.controls +
      dimensions.reviewCadence * WEIGHTS.reviewCadence +
      dimensions.remediation * WEIGHTS.remediation,
  );

  const nudges: string[] = [];
  if (inv.total === 0) nudges.push('Register your first AI system to start your inventory.');
  if (inv.neverReviewed > 0) nudges.push(`${inv.neverReviewed} system(s) have never been reviewed.`);
  if (inv.reviewOverdue > 0) nudges.push(`${inv.reviewOverdue} system(s) are overdue for review.`);
  if (comp.averageCoverage < 50) nudges.push('Control coverage is below 50% — work through your compliance checklist.');
  if (rem.overdue > 0) nudges.push(`${rem.overdue} remediation task(s) are past due.`);
  if ((inv.byRisk?.high ?? 0) + (inv.byRisk?.prohibited ?? 0) > 0)
    nudges.push('You have high-risk systems — ensure each has a DPIA and human oversight documented.');

  return { score, dimensions, nudges };
}

/** Persist a snapshot for the trend chart. Best-effort. */
export async function recordMaturitySnapshot(userId: string, result: MaturityResult, source = 'computed') {
  try {
    await prisma.maturitySnapshot.create({
      data: {
        userId,
        score: result.score,
        dimensions: JSON.stringify(result.dimensions),
        source,
      },
    });
  } catch (err) {
    console.error('[maturity] Failed to record snapshot:', err);
  }
}

export async function getMaturityTrend(userId: string, limit = 30) {
  const rows = await prisma.maturitySnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { score: true, createdAt: true },
  });
  return rows.map((r) => ({ score: r.score, at: r.createdAt.toISOString() }));
}
