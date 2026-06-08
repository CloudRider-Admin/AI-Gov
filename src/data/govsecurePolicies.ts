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
  | 'govsecure-vendor-policy'
  | 'govsecure-third-party-policy';

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
  return {
    heading,
    guidance,
    required: section.level === 1,
    isChecklist: opts.isChecklist,
    govsecureContext,
    sourceDocCode: doc.documentCode,
    sourceSection: section.id,
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
  const joined = parts.join('\n\n');
  return joined.length > MAX_CONTEXT_CHARS
    ? `${joined.slice(0, MAX_CONTEXT_CHARS - 1)}…`
    : joined;
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
//
// Each policy type uses a *curated* set of canonical section headings rather
// than headings scraped from the source PDF/DOCX. The extractor's raw headings
// vary by source document and frequently don't match the standard governance
// section names a policy of that type is expected to contain (Purpose, Scope,
// Roles and Responsibilities, etc.). Curating the headings:
//   1. gives the DocumentOrchestrator a stable, complete section skeleton;
//   2. ensures generated policies cover every canonical section; and
//   3. keeps the source document attached via `sourceDocCode` so the Phase 2.5
//      exemplar retriever still anchors brand voice against the real prose.
// Guidance strings deliberately surface the key governance terms each section
// must address (e.g. "lawful basis", "human review", "approver").

interface CuratedSection {
  heading: string;
  guidance: string;
}

function curatedPolicy(raw: unknown, sections: CuratedSection[]): SectionTemplate[] {
  const doc = raw as ExtractedDocument;
  const firstProse = doc.sections.find((s) =>
    (s.paragraphs ?? []).some((p) => p.trim().length > 0),
  );
  const voiceAnchor = firstProse ? buildContext(firstProse) : undefined;
  return sections.map((s, i) => ({
    heading: s.heading,
    guidance: s.guidance,
    required: true,
    isChecklist: false,
    govsecureContext: i === 0 ? voiceAnchor : undefined,
    sourceDocCode: doc.documentCode,
    sourceSection: String(i + 1),
  }));
}

const THIRD_PARTY_SECTIONS: CuratedSection[] = [
  { heading: 'Purpose', guidance: 'State why this third-party / vendor AI policy exists and the risks it manages.' },
  { heading: 'Scope', guidance: 'Define which AI vendors, services, and procurement activities are covered.' },
  { heading: 'Vendor Risk Tiering', guidance: 'Assign every AI vendor a risk tier based on data access, decision impact, and integration depth.' },
  { heading: 'Due Diligence', guidance: 'Due diligence performed on each AI vendor before onboarding: security, privacy, model provenance, and data-handling review.' },
  { heading: 'Contractual Requirements', guidance: 'Required contract terms — data handling, training-use restrictions, audit rights, and incident notification commitments.' },
  { heading: 'Ongoing Monitoring', guidance: 'Continuous monitoring of vendor risk, subprocessor changes, and performance against contract.' },
  { heading: 'Off-Boarding', guidance: 'Secure off-boarding: data return or deletion, access revocation, and final evidence capture when a vendor relationship ends.' },
];

export const GOVSECURE_POLICY_SECTION_TEMPLATES: Record<
  GovSecurePolicyType,
  SectionTemplate[]
> = {
  'govsecure-aup': curatedPolicy(acceptableUseRaw, [
    { heading: 'Purpose and Scope', guidance: 'State the policy purpose and scope: the personnel, AI tools, and AI-generated outputs it governs, under oversight of the AI Governance Lead.' },
    { heading: 'Roles and Responsibilities', guidance: 'Define accountable roles — led by the AI Governance Lead — and the responsibilities of users, managers, and reviewers.' },
    { heading: 'Permitted Uses', guidance: 'Describe approved AI uses and the intake process required before any new AI tool is adopted.' },
    { heading: 'Prohibited Uses', guidance: 'List prohibited uses, including entering sensitive data into unapproved AI tools.' },
    { heading: 'Data Handling', guidance: 'Rules for handling sensitive data and personal data in AI tools, including data-entry restrictions and classification.' },
    { heading: 'Human Review', guidance: 'Mandate human review of AI-generated outputs before they are acted on, and define when human review is required.' },
    { heading: 'Training and Awareness', guidance: 'Role-based training and awareness required before AI tool access is granted.' },
    { heading: 'Enforcement', guidance: 'Consequences of violations and the exception-request and approval process.' },
    { heading: 'Review and Maintenance', guidance: 'Review cadence and how the policy is maintained and updated over time.' },
  ]),
  'govsecure-governance-policy': curatedPolicy(governanceRaw, [
    { heading: 'Purpose', guidance: 'State the purpose of the AI Governance Policy and the program it establishes.' },
    { heading: 'Scope', guidance: 'Define the AI systems, teams, and decisions the governance program covers.' },
    { heading: 'Governance Structure', guidance: 'Establish the AI Governance Committee, its mandate, membership, and meeting cadence.' },
    { heading: 'Roles and Responsibilities', guidance: 'Responsibilities across the AI Governance Committee, the AI Governance Lead, business owners, and assurance functions.' },
    { heading: 'Risk Tiering', guidance: 'How each AI use case is assigned a risk tier through the intake process.' },
    { heading: 'Approval Authority', guidance: 'Who approves use cases at each risk tier and the human oversight required before launch.' },
    { heading: 'Compliance', guidance: 'How the program maps to NIST AI RMF, the EU AI Act, and ISO/IEC 42001 obligations.' },
    { heading: 'Review Cadence', guidance: 'How often governance artefacts and this policy are reviewed and refreshed.' },
  ]),
  'govsecure-data-privacy-policy': curatedPolicy(dataPrivacyRaw, [
    { heading: 'Purpose', guidance: 'State the purpose of the AI data handling and privacy policy.' },
    { heading: 'Scope', guidance: 'Define the AI systems and personal data processing the policy covers.' },
    { heading: 'Lawful Basis', guidance: 'Establish the lawful basis under the GDPR for processing personal data in AI systems.' },
    { heading: 'Data Minimization', guidance: 'Limit personal data collected and processed by AI systems to what is strictly necessary.' },
    { heading: 'Retention', guidance: 'Retention periods and deletion procedures for AI-processed personal data.' },
    { heading: 'Subject Rights', guidance: 'How data subject rights (access, erasure, objection, and rights related to automated decisions) are honoured under the GDPR.' },
    { heading: 'Cross-Border Transfer', guidance: 'Legal basis and safeguards for any cross-border transfer of personal data.' },
    { heading: 'Vendor Obligations', guidance: 'Privacy obligations imposed on AI vendors and subprocessors that handle personal data.' },
  ]),
  'govsecure-risk-approval-policy': curatedPolicy(riskApprovalRaw, [
    { heading: 'Purpose', guidance: 'State the purpose of the risk assessment and use-case approval policy.' },
    { heading: 'Scope', guidance: 'Define which AI use cases must pass through risk assessment and approval.' },
    { heading: 'Risk Tier Definitions', guidance: 'Define each risk tier (Low, Moderate, High, Prohibited) and the criteria that place a use case in it.' },
    { heading: 'Approval Authority', guidance: 'Name the approver accountable at each risk tier and the approval workflow they follow.' },
    { heading: 'Conditional Approvals', guidance: 'When a conditional approval applies and the conditions an approver may attach before launch.' },
    { heading: 'Reassessment Triggers', guidance: 'Events that trigger reassessment of an approved use case (model change, new data, new jurisdiction, incident).' },
  ]),
  'govsecure-security-policy': curatedPolicy(securityRaw, [
    { heading: 'Purpose', guidance: 'State the purpose of the AI security policy.' },
    { heading: 'Scope', guidance: 'Define the AI systems, environments, and data the policy secures.' },
    { heading: 'Access Controls', guidance: 'Authentication, authorisation, and least-privilege access control for AI systems and data.' },
    { heading: 'Model and Data Security', guidance: 'Protect model integrity and training/inference data; defend against prompt injection and data poisoning.' },
    { heading: 'Logging and Monitoring', guidance: 'Security logging and monitoring of AI system activity and access.' },
    { heading: 'Vendor Security', guidance: 'Security expectations and review for AI vendors and hosted models.' },
    { heading: 'Incident Coordination', guidance: 'Coordination with incident response for AI security events.' },
  ]),
  'govsecure-incident-response-policy': curatedPolicy(incidentResponsePolicyRaw, [
    { heading: 'Purpose', guidance: 'State the purpose of the AI incident response policy.' },
    { heading: 'Scope', guidance: 'Define which AI incidents and systems the policy covers.' },
    { heading: 'Incident Classification', guidance: 'Classify AI incidents by type and severity.' },
    { heading: 'Detection', guidance: 'How AI incidents are detected, reported, and triaged.' },
    { heading: 'Response Procedures', guidance: 'Containment and remediation procedures scaled to incident severity.' },
    { heading: 'Notification', guidance: 'Internal and external notification requirements, including regulators and affected individuals.' },
    { heading: 'Post-Incident Review', guidance: 'Post-incident review capturing root cause, lessons learned, and corrective actions.' },
  ]),
  'govsecure-human-oversight-policy': curatedPolicy(humanOversightRaw, [
    { heading: 'Purpose', guidance: 'State the purpose of the human oversight and decision-making policy.' },
    { heading: 'Scope', guidance: 'Define which AI systems and decisions require defined human oversight.' },
    { heading: 'Oversight Modes', guidance: 'Define oversight modes — human-in-the-loop, human-on-the-loop, and human-in-command — and when each applies.' },
    { heading: 'Reviewer Qualifications', guidance: 'Qualifications, authority, and training required of a human reviewer.' },
    { heading: 'Escalation', guidance: 'Escalation paths when a reviewer is uncertain or an AI output is potentially harmful.' },
    { heading: 'Override Authority', guidance: 'Who may override AI outputs, on what basis, and how each override is logged.' },
    { heading: 'Audit Trail', guidance: 'Records retained to evidence that human oversight occurred.' },
  ]),
  'govsecure-vendor-policy': curatedPolicy(thirdPartyRaw, THIRD_PARTY_SECTIONS),
  'govsecure-third-party-policy': curatedPolicy(thirdPartyRaw, THIRD_PARTY_SECTIONS),
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
  'govsecure-third-party-policy': 'AI Third-Party / Vendor Due Diligence Policy',
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
