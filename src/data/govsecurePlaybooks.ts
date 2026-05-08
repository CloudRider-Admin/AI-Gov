/**
 * GovSecure flagship playbook + questionnaire data layer — Phase 3.
 *
 * Bundles the AI Chef Operating Model, the 90-Day Blueprint, and the TPRM
 * questionnaire so the orchestrators can build phasesContext / sectionsContext
 * without re-deriving them from raw extracted JSON.
 *
 * The hard-coded structures live in `govsecureKnowledge.ts` (since they're
 * stable contracts the product sells against). This file only:
 *   1. Re-exports them as the canonical Phase 3 names.
 *   2. Builds `TPRM_QUESTIONNAIRE` from the extracted source JSON.
 *   3. Builds `SectionTemplate[]` for `govsecure-tprm` and
 *      `govsecure-nist-rcm` so they slot into `DOCUMENT_SECTION_TEMPLATES`.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 3.2 + 3.3
 */

import {
  AI_CHEF_STATIONS,
  GOVSECURE_90_DAY_PHASES,
  GOVSECURE_NIST_RCM,
  getDocumentBySubType,
} from './govsecureKnowledge';
import type { ExtractedSection, NISTControl } from '@/types/govsecure';
import type { SectionTemplate } from '@/lib/ai/documentTemplates';

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { AI_CHEF_STATIONS, GOVSECURE_90_DAY_PHASES, GOVSECURE_NIST_RCM };

// ─── TPRM questionnaire ─────────────────────────────────────────────────────

export interface TPRMSection {
  id: string;
  heading: string;
  /** Short rationale describing what the section's questions cover. */
  guidance: string;
  /** Original prose / bullets from the source questionnaire — voice anchor. */
  context?: string;
  importance: 'Required' | 'High' | 'Medium' | 'Conditional';
  /** Document code of the source extract (`GS-QSTN-TPRM-01`). */
  sourceDocCode: string;
  /** Section id within the source document. */
  sourceSection: string;
}

const TPRM_DOC = getDocumentBySubType('questionnaires', 'tprm');

const IMPORTANCE_RE = /\((Required|High Importance|Medium|Low|Conditional|If Applicable|Insurance-Critical|Internal)\)/i;

function classifyImportance(heading: string): TPRMSection['importance'] {
  const m = heading.match(IMPORTANCE_RE);
  if (!m) return 'Medium';
  const tag = m[1].toLowerCase();
  if (tag === 'required') return 'Required';
  if (tag === 'insurance-critical' || tag === 'high importance') return 'High';
  if (tag === 'if applicable' || tag === 'conditional') return 'Conditional';
  return 'Medium';
}

function tprmGuidance(section: ExtractedSection): string {
  const first = section.paragraphs[0]?.trim();
  if (first && first.length > 30) return first.slice(0, 240);
  if (section.bullets.length) {
    return `Cover: ${section.bullets.slice(0, 4).join('; ')}`;
  }
  return `Author this section in the voice of the GovSecure TPRM questionnaire (${section.heading}).`;
}

/**
 * The TPRM questionnaire's 9 substantive sections (drops the title row at
 * id "1"). Ordered by source section id so the runtime list mirrors the
 * licensed document.
 */
export const TPRM_QUESTIONNAIRE: TPRMSection[] = (TPRM_DOC?.sections ?? [])
  .filter((s) => /^\d+\)/.test(s.heading)) // skip the title row
  .map((s): TPRMSection => ({
    id: s.id,
    heading: s.heading.replace(IMPORTANCE_RE, '').trim(),
    guidance: tprmGuidance(s),
    context: [s.paragraphs.join('\n\n'), s.bullets.map((b) => `- ${b}`).join('\n')]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 1500),
    importance: classifyImportance(s.heading),
    sourceDocCode: TPRM_DOC?.documentCode ?? 'GS-QSTN-TPRM-01',
    sourceSection: s.id,
  }));

/**
 * `SectionTemplate[]` shape that slots into `DOCUMENT_SECTION_TEMPLATES`
 * for the `govsecure-tprm` document type. Phase 3.5 will replace one-shot
 * generation with the multi-turn `WorkflowOrchestrator` — until then this
 * lets the user request a complete TPRM straight from the advisor.
 */
export const TPRM_SECTION_TEMPLATES: SectionTemplate[] = TPRM_QUESTIONNAIRE.map((s) => ({
  heading: s.heading,
  guidance: s.guidance,
  required: s.importance === 'Required' || s.importance === 'High',
  isChecklist: true,
  govsecureContext: s.context,
  sourceDocCode: s.sourceDocCode,
  sourceSection: s.sourceSection,
}));

// ─── NIST RCM template ─────────────────────────────────────────────────────

/**
 * Build a `SectionTemplate[]` rendering of the NIST Risk Control Matrix.
 * One section per control, ordered by the source spreadsheet. Used when
 * the user explicitly asks Govi to generate a NIST RCM rollup against
 * their portfolio.
 */
export const NIST_RCM_SECTION_TEMPLATES: SectionTemplate[] = buildNistRcmTemplates(GOVSECURE_NIST_RCM);

function buildNistRcmTemplates(controls: NISTControl[]): SectionTemplate[] {
  const sourceDocCode = 'GS-FRAM-NISTRCM-01';
  if (!controls.length) {
    // Fallback so the type still renders even if the bundled extract is empty.
    return [
      {
        heading: 'Control Matrix',
        guidance:
          'Render a row per NIST AI RMF control covering risk category, statement, ' +
          'example failure mode, root cause, and control objective.',
        required: true,
        isChecklist: true,
        sourceDocCode,
        sourceSection: '1',
      },
    ];
  }
  return controls.map((c, i): SectionTemplate => ({
    heading: `${c.controlId} — ${c.riskCategory}`.trim() || `NIST Control ${i + 1}`,
    guidance:
      [c.riskStatement, c.controlObjective].filter(Boolean).join(' ').slice(0, 240) ||
      `Author the control narrative for ${c.controlId}.`,
    required: true,
    isChecklist: false,
    govsecureContext: [c.riskStatement, c.riskExample, c.riskRootCause, c.controlObjective]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 1500),
    sourceDocCode,
    sourceSection: c.controlId,
  }));
}

// ─── Display titles for Phase 3 types ───────────────────────────────────────

export const PHASE3_DOCUMENT_TITLES = {
  'govsecure-tprm': 'AI Third-Party Risk Management (TPRM) Questionnaire',
  'govsecure-nist-rcm': 'NIST AI RMF Risk Control Matrix',
} as const;
