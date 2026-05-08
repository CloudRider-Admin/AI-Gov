/**
 * TPRM workflow definition — Phase 3.5.
 *
 * Wraps the 9-section TPRM questionnaire (`TPRM_QUESTIONNAIRE` from
 * `govsecurePlaybooks.ts`) as a stepwise workflow. Each section becomes one
 * scored step with a 1-5 maturity rubric and a per-section red-flag check.
 *
 * Future iteration: split each section into its individual sub-questions for
 * a more granular flow. Section-level scoring is the v1 contract.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 3.5.3
 */

import { TPRM_QUESTIONNAIRE } from '@/data/govsecurePlaybooks';
import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';
import type {
  RedFlag,
  ScoringRubric,
  WorkflowDefinition,
  WorkflowFinalizeOutput,
  WorkflowState,
  WorkflowStep,
} from '@/types/workflows';

import { aggregateScores, summarizeRedFlags } from '../workflowOrchestrator';

// ─── Rubric ─────────────────────────────────────────────────────────────────

const TPRM_RUBRIC: ScoringRubric = {
  scale: '1–5 maturity (1 = absent, 5 = best-in-class)',
  anchors: {
    1: 'Absent or undocumented — no controls, no evidence',
    2: 'Ad-hoc — controls exist informally, no consistency',
    3: 'Documented — process defined, partial enforcement',
    4: 'Managed — process enforced, monitored, periodically reviewed',
    5: 'Optimized — controls audited, continuously improved, evidence available on demand',
  },
  deficiencyBelow: 3,
};

const REQUIRED_DEFICIENCY_THRESHOLD = 3;
const HIGH_DEFICIENCY_THRESHOLD = 2;

// ─── Step builders ──────────────────────────────────────────────────────────

const TPRM_STEPS: WorkflowStep[] = TPRM_QUESTIONNAIRE.map((section): WorkflowStep => {
  const isCritical = section.importance === 'Required' || section.importance === 'High';
  return {
    sectionId: section.id,
    sectionGroup: section.heading,
    question: `Rate the vendor's maturity for "${section.heading}" on the GovSecure 1–5 scale, then describe the supporting evidence in your follow-up text.`,
    responseType: 'score',
    required: isCritical,
    helpText: section.guidance,
    scoringRubric: TPRM_RUBRIC,
    validation: (input: unknown) => {
      if (typeof input !== 'number' || !Number.isInteger(input) || input < 1 || input > 5) {
        return { ok: false, message: 'Answer must be an integer between 1 and 5.' };
      }
      return { ok: true };
    },
    redFlagCheck: (answer: unknown): RedFlag | null => {
      if (typeof answer !== 'number') return null;
      // Hard tripwires:
      //   - Required section scoring < 3 → high severity
      //   - High-importance scoring < 2 → critical severity
      if (section.importance === 'Required' && answer < REQUIRED_DEFICIENCY_THRESHOLD) {
        return {
          sectionId: section.id,
          label: `${section.heading}: required maturity not met`,
          severity: 'high',
          reason: `Vendor scored ${answer}/5 in a Required section. Block until remediated.`,
        };
      }
      if (section.importance === 'High' && answer < HIGH_DEFICIENCY_THRESHOLD) {
        return {
          sectionId: section.id,
          label: `${section.heading}: critical maturity gap`,
          severity: 'critical',
          reason: `Vendor scored ${answer}/5 in a High-importance section. Escalate to Security and Legal.`,
        };
      }
      if (answer < REQUIRED_DEFICIENCY_THRESHOLD) {
        return {
          sectionId: section.id,
          label: `${section.heading}: below baseline maturity`,
          severity: 'medium',
          reason: `Vendor scored ${answer}/5 — capture remediation plan and re-score within 90 days.`,
        };
      }
      return null;
    },
  };
});

// ─── Finalizer ──────────────────────────────────────────────────────────────

async function finalizeTPRM(state: WorkflowState): Promise<WorkflowFinalizeOutput> {
  const { average, count } = aggregateScores(state.scores);
  const sortedFlags = summarizeRedFlags(state.redFlags);
  const deficiencies = Object.entries(state.scores)
    .filter(([, score]) => score < REQUIRED_DEFICIENCY_THRESHOLD)
    .map(([sectionId]) => sectionId);

  const vendorName = stringContext(state.context.vendorName) ?? 'Unnamed Vendor';
  const useCaseName = stringContext(state.context.useCaseName) ?? `${vendorName} TPRM Assessment`;
  const tier = (stringContext(state.context.riskTier) as 'Low' | 'Medium' | 'High' | 'Critical' | undefined) ?? 'Medium';
  const decision = recommendDecision(average, sortedFlags);

  // Build a GovernanceDocumentOutput so the artifact persistence + branded
  // exporter can consume it without changes.
  const document: GovernanceDocumentOutput = {
    documentType: 'govsecure-tprm',
    title: `TPRM Assessment — ${vendorName}`,
    riskTier: tier,
    useCaseName,
    reviewCycle: 'Annual',
    generatedAt: new Date().toISOString(),
    markdownExport: '',
    sections: [
      {
        heading: 'Executive Summary',
        required: true,
        content: buildExecutiveSummary({ vendorName, decision, average, count, flagCount: sortedFlags.length }),
      },
      ...TPRM_QUESTIONNAIRE.map((section) => {
        const ans = state.answers[section.id];
        const score = state.scores[section.id];
        const scoreLine = score !== undefined ? `**Maturity score: ${score}/5**\n\n` : '';
        const evidenceLine = ans?.value !== undefined && typeof ans.value !== 'number'
          ? `Evidence: ${String(ans.value)}\n\n`
          : '';
        const flag = sortedFlags.find((f) => f.sectionId === section.id);
        const flagLine = flag ? `> ⚠ ${flag.label} — ${flag.reason}\n\n` : '';
        return {
          heading: section.heading,
          required: section.importance === 'Required' || section.importance === 'High',
          content: `${scoreLine}${evidenceLine}${flagLine}${section.guidance}`,
        };
      }),
      {
        heading: 'Red Flag Summary',
        required: true,
        content: sortedFlags.length === 0
          ? 'No red flags raised during the assessment.'
          : sortedFlags
              .map((f) => `- **${f.severity.toUpperCase()}** — ${f.label}: ${f.reason}`)
              .join('\n'),
      },
      {
        heading: 'Recommended Decision',
        required: true,
        content: `**Decision: ${decision}**\n\nBased on an average maturity of ${average ?? 'n/a'}/5 across ${count} scored sections, with ${sortedFlags.length} red flag(s) raised.`,
      },
    ],
    frameworkCitations: [
      {
        framework: 'NIST AI RMF',
        reference: 'GOVERN 6.1',
        description: 'Policies and procedures address AI risks associated with third-party entities.',
      },
      {
        framework: 'EU AI Act',
        reference: 'Article 25',
        description: 'Obligations along the AI value chain — providers and deployers must coordinate.',
      },
      {
        framework: 'ISO/IEC 42001',
        reference: 'Clause 8.4',
        description: 'AI system impact assessment — third-party AI systems must be evaluated for risk.',
      },
    ],
  };

  document.markdownExport = buildMarkdown(document);

  return {
    document,
    summary: {
      totalSteps: state.totalSteps,
      answered: Object.keys(state.answers).length,
      averageScore: average,
      redFlagCount: sortedFlags.length,
      deficiencies,
    },
  };
}

function buildExecutiveSummary(opts: {
  vendorName: string;
  decision: string;
  average: number | undefined;
  count: number;
  flagCount: number;
}): string {
  return [
    `Assessment of ${opts.vendorName} across the GovSecure TPRM AI Questionnaire.`,
    '',
    `**Aggregate maturity:** ${opts.average ?? 'n/a'}/5 across ${opts.count} scored sections.`,
    `**Red flags:** ${opts.flagCount}`,
    `**Recommended decision:** ${opts.decision}`,
  ].join('\n');
}

function recommendDecision(
  average: number | undefined,
  flags: RedFlag[],
): 'Approve' | 'Approve with Conditions' | 'Reject' {
  if (flags.some((f) => f.severity === 'critical')) return 'Reject';
  if (flags.some((f) => f.severity === 'high')) return 'Approve with Conditions';
  if (average !== undefined && average < 3) return 'Approve with Conditions';
  return 'Approve';
}

function buildMarkdown(doc: GovernanceDocumentOutput): string {
  const lines: string[] = [`# ${doc.title}`, '', `**Risk Tier:** ${doc.riskTier}`, ''];
  for (const s of doc.sections) {
    lines.push(`## ${s.heading}`);
    if (s.content) lines.push(s.content, '');
  }
  if (doc.frameworkCitations.length) {
    lines.push('## Framework References');
    for (const c of doc.frameworkCitations) {
      lines.push(`- **${c.framework} — ${c.reference}:** ${c.description}`);
    }
  }
  return lines.join('\n');
}

function stringContext(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// ─── Definition export ─────────────────────────────────────────────────────

export const TPRM_WORKFLOW: WorkflowDefinition = {
  type: 'tprm',
  label: 'AI Third-Party Risk Management Questionnaire',
  steps: TPRM_STEPS,
  finalize: finalizeTPRM,
};
