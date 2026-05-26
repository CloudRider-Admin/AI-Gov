/**
 * GovSecure document templates — Phase 2.
 *
 * Builds `SectionTemplate[]` for each new GovSecure document type from the
 * raw JSON the Phase-0 extractor produced. The DocumentOrchestrator merges
 * these into `DOCUMENT_SECTION_TEMPLATES`; the orchestrator then asks GPT-4o
 * to render each section using the GovSecure guidance + (in Phase 2.5) the
 * `govsecureContext` exemplar prose as a voice anchor.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.2
 */

import type { SectionTemplate } from '@/lib/ai/documentTemplates';
import type { ExtractedDocument, ExtractedSection } from '@/types/govsecure';

import acceptableUseRaw from './govsecureContent/policies/acceptable-use.json';
import governanceRaw from './govsecureContent/policies/governance.json';
import dataPrivacyRaw from './govsecureContent/policies/data-privacy.json';
import riskApprovalRaw from './govsecureContent/policies/risk-approval.json';
import securityRaw from './govsecureContent/policies/security.json';
import incidentResponsePolicyRaw from './govsecureContent/policies/incident-response.json';
import humanOversightRaw from './govsecureContent/policies/human-oversight.json';
import thirdPartyRaw from './govsecureContent/policies/third-party.json';

import intakeFormRaw from './govsecureContent/checklists/intake-form.json';
import evidencePackChecklistRaw from './govsecureContent/checklists/evidence-pack.json';
import incidentResponseChecklistRaw from './govsecureContent/checklists/incident-response.json';
import vendorDDRaw from './govsecureContent/checklists/third-party-dd.json';
import shadowAiRaw from './govsecureContent/checklists/shadow-ai-discovery.json';
import inventoryRaw from './govsecureContent/checklists/inventory-registry.json';
import modelValidationRaw from './govsecureContent/checklists/model-validation.json';
import monitoringRaw from './govsecureContent/checklists/monitoring-revalidation.json';
import securityReviewRaw from './govsecureContent/checklists/security-review.json';
import dpiaScreeningRaw from './govsecureContent/checklists/dpia-screening.json';
import humanOversightChecklistRaw from './govsecureContent/checklists/human-oversight-escalation.json';
import changeManagementRaw from './govsecureContent/checklists/change-management.json';
import trainingAwarenessRaw from './govsecureContent/checklists/training-awareness.json';
import riskAssessmentTemplateRaw from './govsecureContent/checklists/risk-assessment-template.json';

// ─── Document type unions (mirror types/documents.ts; importing here would
//      be circular, so we redeclare and the type system enforces alignment) ──

export type GovSecurePolicyType =
  | 'govsecure-aup'
  | 'govsecure-governance-policy'
  | 'govsecure-data-privacy-policy'
  | 'govsecure-risk-approval-policy'
  | 'govsecure-security-policy'
  | 'govsecure-incident-response-policy'
  | 'govsecure-human-oversight-policy'
  | 'govsecure-vendor-policy';

export type GovSecureChecklistType =
  | 'govsecure-checklist-intake'
  | 'govsecure-checklist-evidence-pack'
  | 'govsecure-checklist-incident-response'
  | 'govsecure-checklist-vendor-dd'
  | 'govsecure-checklist-shadow-ai'
  | 'govsecure-checklist-inventory'
  | 'govsecure-checklist-model-validation'
  | 'govsecure-checklist-monitoring'
  | 'govsecure-checklist-security'
  | 'govsecure-checklist-dpia'
  | 'govsecure-checklist-human-oversight'
  | 'govsecure-checklist-change-management'
  | 'govsecure-checklist-training'
  | 'govsecure-checklist-risk-assessment';

export type GovSecureDocumentType = GovSecurePolicyType | GovSecureChecklistType;

// ─── Builder ────────────────────────────────────────────────────────────────

const PREAMBLE_HEADINGS = new Set(['(preamble)', '']);
const MAX_GUIDANCE_CHARS = 240;
const MAX_CONTEXT_CHARS = 1500;

/**
 * Convert an extracted section to the SectionTemplate the orchestrator wants.
 * `isChecklist` is set per-document (policies = prose, checklists = bullets).
 */
function toSectionTemplate(
  section: ExtractedSection,
  doc: ExtractedDocument,
  opts: { isChecklist: boolean },
): SectionTemplate {
  const heading = section.heading.trim();
  const guidance = buildGuidance(section);
  const govsecureContext = buildContext(section);
  const hasTables = Boolean(
    section.tables?.some((t) => t.length > 0 && t.some((row) => row.length > 0)),
  );
  return {
    heading,
    guidance,
    required: section.level === 1,
    isChecklist: opts.isChecklist,
    govsecureContext,
    sourceDocCode: doc.documentCode,
    sourceSection: section.id,
    hasTables,
  };
}

function buildGuidance(section: ExtractedSection): string {
  const candidates = [
    section.paragraphs[0]?.trim(),
    section.bullets.length ? `Cover: ${section.bullets.slice(0, 4).join('; ')}` : '',
    section.paragraphs.slice(1, 2).join(' ').trim(),
  ].filter(Boolean) as string[];
  const joined = candidates.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) {
    return `Author this section in the voice of the source GovSecure ${section.heading} template.`;
  }
  return joined.length > MAX_GUIDANCE_CHARS
    ? `${joined.slice(0, MAX_GUIDANCE_CHARS - 1)}…`
    : joined;
}

function buildContext(section: ExtractedSection): string {
  const parts: string[] = [];
  if (section.paragraphs.length) parts.push(section.paragraphs.join('\n\n'));
  if (section.bullets.length) parts.push(section.bullets.map((b) => `- ${b}`).join('\n'));
  // Source policies carry their Purpose / Scope / Owner / Audience metadata
  // as DOCX tables; the LLM must see them or the generated document drops
  // the structural backbone of the template.
  if (section.tables?.length) {
    parts.push(section.tables.map(renderTableAsMarkdown).join('\n\n'));
  }
  const joined = parts.join('\n\n');
  return joined.length > MAX_CONTEXT_CHARS
    ? `${joined.slice(0, MAX_CONTEXT_CHARS - 1)}…`
    : joined;
}

function renderTableAsMarkdown(table: string[][]): string {
  if (!table.length) return '';
  const colCount = Math.max(...table.map((row) => row.length));
  if (colCount === 0) return '';
  const pad = (row: string[]) =>
    Array.from({ length: colCount }, (_, i) => (row[i] ?? '').replace(/\s+/g, ' ').trim());
  const lines: string[] = [];
  // Two-column key/value tables (the dominant shape in GovSecure policies)
  // render as `| Key | Value |` which the LLM can mirror cleanly.
  lines.push(`| ${pad(table[0]).join(' | ')} |`);
  lines.push(`| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`);
  for (let i = 1; i < table.length; i++) {
    lines.push(`| ${pad(table[i]).join(' | ')} |`);
  }
  return lines.join('\n');
}

/**
 * Build SectionTemplates for one source document. Skips preamble sections
 * that don't carry actual policy content.
 */
function buildTemplates(
  raw: unknown,
  opts: { isChecklist: boolean },
): SectionTemplate[] {
  const doc = raw as ExtractedDocument;
  return doc.sections
    .filter((s) => !PREAMBLE_HEADINGS.has(s.heading.trim().toLowerCase()))
    .map((s) => toSectionTemplate(s, doc, opts));
}

// ─── Policy templates ───────────────────────────────────────────────────────

export const GOVSECURE_POLICY_SECTION_TEMPLATES: Record<
  GovSecurePolicyType,
  SectionTemplate[]
> = {
  'govsecure-aup': buildTemplates(acceptableUseRaw, { isChecklist: false }),
  'govsecure-governance-policy': buildTemplates(governanceRaw, { isChecklist: false }),
  'govsecure-data-privacy-policy': buildTemplates(dataPrivacyRaw, { isChecklist: false }),
  'govsecure-risk-approval-policy': buildTemplates(riskApprovalRaw, { isChecklist: false }),
  'govsecure-security-policy': buildTemplates(securityRaw, { isChecklist: false }),
  'govsecure-incident-response-policy': buildTemplates(incidentResponsePolicyRaw, { isChecklist: false }),
  'govsecure-human-oversight-policy': buildTemplates(humanOversightRaw, { isChecklist: false }),
  'govsecure-vendor-policy': buildTemplates(thirdPartyRaw, { isChecklist: false }),
};

/**
 * Per plan §2.7, the existing 12-section `evidence-pack` template is already
 * aligned with the GovSecure Evidence Pack Checklist. The Phase-0 extractor
 * could not pull structure from the source PDF (preamble-only output), so for
 * this one type we reuse the curated curated template by mirroring its
 * headings here. Source: `documentTemplates.ts` `evidence-pack` block.
 */
const EVIDENCE_PACK_CURATED_HEADINGS: { heading: string; guidance: string }[] = [
  { heading: 'Evidence Pack Cover & Index', guidance: 'Cover page with use case name, version, date, owners, and table of contents.' },
  { heading: 'Use Case Authorization & Intake Evidence', guidance: 'Intake form, business justification, scope definition, triage outcome, approvals.' },
  { heading: 'Governance & Policy Compliance Evidence', guidance: 'Policy applicability, standards identified, control mapping, compliance requirements.' },
  { heading: 'Risk Assessment & Triage Evidence', guidance: 'Completed risk assessment, residual risk rating, risk treatment plan, owners.' },
  { heading: 'Privacy & Data Protection Evidence', guidance: 'Data classification, data flow, lawful basis, DPIA, cross-border transfers.' },
  { heading: 'Security Control Evidence', guidance: 'Security architecture review, auth controls, logging, encryption, threat model.' },
  { heading: 'Model / System Documentation Evidence', guidance: 'Model description, source, model card, training data summary, version info.' },
  { heading: 'Vendor / Third-Party Evidence', guidance: 'Vendor risk assessment, contract review, security docs, retention terms, subprocessors.' },
  { heading: 'Testing, Validation & Quality Evidence', guidance: 'Test plan, functional testing, evaluation metrics, UAT, go-live readiness.' },
  { heading: 'Monitoring & Operations Evidence', guidance: 'Monitoring plan, logging evidence, drift schedule, incident tracking, change management.' },
  { heading: 'Human Oversight & Accountability Evidence', guidance: 'Reviewer roles, escalation path, override process, training, accountability matrix.' },
  { heading: 'Audit Readiness & Traceability Checks', guidance: 'All artifacts present, dates current, evidence traceable, approvals signed, next review date.' },
];

function buildEvidencePackTemplates(): SectionTemplate[] {
  const doc = evidencePackChecklistRaw as ExtractedDocument;
  const preambleProse = doc.sections[0]?.paragraphs?.join('\n\n') ?? '';
  return EVIDENCE_PACK_CURATED_HEADINGS.map((s, i) => ({
    heading: s.heading,
    guidance: s.guidance,
    required: true,
    isChecklist: true,
    govsecureContext: i === 0 ? preambleProse : undefined,
    sourceDocCode: doc.documentCode,
    sourceSection: String(i + 1),
  }));
}

// ─── Checklist templates ────────────────────────────────────────────────────

export const GOVSECURE_CHECKLIST_SECTION_TEMPLATES: Record<
  GovSecureChecklistType,
  SectionTemplate[]
> = {
  'govsecure-checklist-intake': buildTemplates(intakeFormRaw, { isChecklist: true }),
  'govsecure-checklist-evidence-pack': buildEvidencePackTemplates(),
  'govsecure-checklist-incident-response': buildTemplates(incidentResponseChecklistRaw, { isChecklist: true }),
  'govsecure-checklist-vendor-dd': buildTemplates(vendorDDRaw, { isChecklist: true }),
  'govsecure-checklist-shadow-ai': buildTemplates(shadowAiRaw, { isChecklist: true }),
  'govsecure-checklist-inventory': buildTemplates(inventoryRaw, { isChecklist: true }),
  'govsecure-checklist-model-validation': buildTemplates(modelValidationRaw, { isChecklist: true }),
  'govsecure-checklist-monitoring': buildTemplates(monitoringRaw, { isChecklist: true }),
  'govsecure-checklist-security': buildTemplates(securityReviewRaw, { isChecklist: true }),
  'govsecure-checklist-dpia': buildTemplates(dpiaScreeningRaw, { isChecklist: true }),
  'govsecure-checklist-human-oversight': buildTemplates(humanOversightChecklistRaw, { isChecklist: true }),
  'govsecure-checklist-change-management': buildTemplates(changeManagementRaw, { isChecklist: true }),
  'govsecure-checklist-training': buildTemplates(trainingAwarenessRaw, { isChecklist: true }),
  'govsecure-checklist-risk-assessment': buildTemplates(riskAssessmentTemplateRaw, { isChecklist: true }),
};

// ─── Combined record + display titles ───────────────────────────────────────

export const GOVSECURE_DOCUMENT_TEMPLATES: Record<GovSecureDocumentType, SectionTemplate[]> = {
  ...GOVSECURE_POLICY_SECTION_TEMPLATES,
  ...GOVSECURE_CHECKLIST_SECTION_TEMPLATES,
};

export const GOVSECURE_DOCUMENT_TITLES: Record<GovSecureDocumentType, string> = {
  'govsecure-aup': 'Acceptable Use Policy',
  'govsecure-governance-policy': 'AI Governance Policy',
  'govsecure-data-privacy-policy': 'AI Data Privacy Policy',
  'govsecure-risk-approval-policy': 'AI Risk & Approval Policy',
  'govsecure-security-policy': 'AI Security Policy',
  'govsecure-incident-response-policy': 'AI Incident Response Policy',
  'govsecure-human-oversight-policy': 'AI Human Oversight Policy',
  'govsecure-vendor-policy': 'AI Third-Party / Vendor Policy',
  'govsecure-checklist-intake': 'AI Use Case Intake Checklist',
  'govsecure-checklist-evidence-pack': 'AI Evidence Pack Checklist',
  'govsecure-checklist-incident-response': 'AI Incident Response Checklist',
  'govsecure-checklist-vendor-dd': 'AI Vendor Due Diligence Checklist',
  'govsecure-checklist-shadow-ai': 'Shadow AI Discovery Checklist',
  'govsecure-checklist-inventory': 'AI Inventory & Registry Checklist',
  'govsecure-checklist-model-validation': 'AI Model Validation & Testing Checklist',
  'govsecure-checklist-monitoring': 'AI Monitoring & Revalidation Checklist',
  'govsecure-checklist-security': 'AI Security Review Checklist',
  'govsecure-checklist-dpia': 'AI Privacy & DPIA Screening Checklist',
  'govsecure-checklist-human-oversight': 'AI Human Oversight & Escalation Checklist',
  'govsecure-checklist-change-management': 'AI Change Management Checklist',
  'govsecure-checklist-training': 'AI Training & Role-Based Awareness Checklist',
  'govsecure-checklist-risk-assessment': 'AI Risk Assessment Checklist',
};

/** All 22 GovSecure document type identifiers as a flat array. */
export const GOVSECURE_DOCUMENT_TYPE_VALUES: readonly GovSecureDocumentType[] = [
  ...(Object.keys(GOVSECURE_POLICY_SECTION_TEMPLATES) as GovSecurePolicyType[]),
  ...(Object.keys(GOVSECURE_CHECKLIST_SECTION_TEMPLATES) as GovSecureChecklistType[]),
] as const;
