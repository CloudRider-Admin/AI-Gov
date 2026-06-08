// ─── AI Governance Document Types ───────────────────────────────────────────
// Grounded in:
//   • AI Intake Risk Assessment Checklist (10 drivers, 6 auto-high triggers, 3 tiers)
//   • AI Evidence Pack Checklist (12 sections)
//   • NIST AI RMF 1.0 (GOVERN / MAP / MEASURE / MANAGE)
//   • EU AI Act (risk classification + article obligations)
//   • ISO/IEC 42001 (clause references)

// ─── Shared ──────────────────────────────────────────────────────────────────

export type RiskTierLabel = 'Low' | 'Medium' | 'High' | 'Critical';

export type LaunchDecision = 'Go' | 'Conditional Go' | 'No-Go';

export type ModelType = 'GenAI' | 'Predictive ML' | 'Rules + ML' | 'Vendor Feature';

export type DeploymentType = 'Internal' | 'Customer-facing' | 'Public-facing';

export type EUAIActClassification =
  | 'Prohibited'
  | 'High-Risk'
  | 'Limited-Risk'
  | 'Minimal-Risk'
  | 'General-Purpose';

export type RequiredApprover = 'Compliance' | 'Security' | 'Legal/Privacy' | 'Risk/ERM';

// ─── Intake Risk Assessment ───────────────────────────────────────────────────

export interface RiskDriver {
  /** Identifier matching RISK_DRIVERS constant, e.g. 'decision-impact' */
  id: string;
  /** Human label, e.g. "Decision Impact" */
  label: string;
  /** Short description of what this driver covers */
  description: string;
  /** AI-assigned score: 0 = None/N/A, 1 = Low, 2 = Medium, 3 = High */
  score: 0 | 1 | 2 | 3;
  /** AI-generated rationale for the score, grounded in the use case description */
  notes: string;
  /** NIST AI RMF subcategories this driver maps to, e.g. ['MAP 1.1', 'MEASURE 2.1'] */
  nistMappings: string[];
  /** EU AI Act articles relevant to this driver, e.g. ['Article 14 (Human oversight)'] */
  euAiActMappings: string[];
}

export interface AutoHighTrigger {
  /** Identifier matching AUTO_HIGH_TRIGGERS constant */
  id: string;
  /** Full description of the trigger condition */
  description: string;
  /** Whether this trigger fires for the described use case */
  fired: boolean;
  /** Explanation of why the trigger does or does not apply */
  reason: string;
}

export interface RequiredArtifact {
  /** Short artifact name, e.g. "Use Case Summary" */
  name: string;
  /** Brief description of what the artifact must cover */
  description: string;
  /** Minimum tier at which this artifact is required */
  tier: RiskTierLabel;
  /** Whether this artifact has been generated / provided */
  status: 'generated' | 'pending' | 'not-required';
}

export interface IntakeRiskAssessment {
  // ── Use case metadata ──────────────────────────────────────────────────────
  useCaseName: string;
  owner: string;
  businessUnit: string;
  modelType: ModelType;
  deployment: DeploymentType;
  jurisdictions: string[];
  goLiveTarget?: string;
  assessmentDate: string;

  // ── Section A: Risk Scoring ────────────────────────────────────────────────
  /** All 10 risk drivers with scores and notes */
  riskDrivers: RiskDriver[];
  /** Sum of all driver scores, max 30 */
  totalScore: number;

  // ── Section B: Auto-High Triggers ─────────────────────────────────────────
  autoHighTriggers: AutoHighTrigger[];
  /** True if any auto-high trigger fired */
  autoHighFired: boolean;

  // ── Section C: Tier Determination ─────────────────────────────────────────
  riskTier: RiskTierLabel;
  /** Scoring rationale: e.g. "Score 17/30 with 2 Auto-High triggers → HIGH" */
  tierRationale: string;
  requiredApprovers: RequiredApprover[];

  // ── Section D: Required Artifacts ─────────────────────────────────────────
  /** Cumulative artifact list for the determined tier */
  requiredArtifacts: RequiredArtifact[];

  // ── Section E: Launch Decision ────────────────────────────────────────────
  launchDecision: LaunchDecision;
  /** Conditions that must be met for a Conditional Go */
  conditions?: string;
  nextReviewDate: string;
  reassessmentTriggers: string[];

  // ── Framework Mappings ────────────────────────────────────────────────────
  euAIActClassification: EUAIActClassification;
  euAIActRationale: string;
  /** Top NIST AI RMF subcategories most relevant to this use case */
  nistKeySubcategories: string[];

  // ── Export ────────────────────────────────────────────────────────────────
  /** Full assessment formatted as markdown (ready for PDF export) */
  markdownExport: string;
}

// ─── Governance Documents ─────────────────────────────────────────────────────

/**
 * Document types Govi can generate. Phase 2 added 22 GovSecure-licensed
 * variants on top of the 11 generic governance documents.
 *
 * The ordering mirrors the runtime `DOCUMENT_TYPE_VALUES` array exported
 * from `@/lib/ai/schemas`; if you add a new type here, add it there too
 * (the eslint config does NOT enforce this — it's caught at type-check time
 * because the Zod enum's element type is the same union).
 */
export type DocumentType =
  // ── Generic governance documents (predate GovSecure integration) ──────────
  | 'use-case-summary'
  | 'data-sheet'
  | 'vendor-model-facts'
  | 'threat-model'
  | 'human-oversight-statement'
  | 'dpia'
  | 'model-card'
  | 'risk-memo'
  | 'operational-readiness-plan'
  | 'monitoring-plan'
  | 'evidence-pack'
  // ── GovSecure policies (Phase 2.1) ────────────────────────────────────────
  | 'govsecure-aup'
  | 'govsecure-governance-policy'
  | 'govsecure-data-privacy-policy'
  | 'govsecure-risk-approval-policy'
  | 'govsecure-security-policy'
  | 'govsecure-incident-response-policy'
  | 'govsecure-human-oversight-policy'
  | 'govsecure-vendor-policy'
  | 'govsecure-third-party-policy'
  // ── GovSecure checklists (Phase 2.1) ──────────────────────────────────────
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
  | 'govsecure-checklist-risk-assessment'
  // ── Phase 3: GovSecure flagship questionnaires + framework templates ──
  | 'govsecure-tprm'
  | 'govsecure-nist-rcm';

export interface FrameworkCitation {
  framework: 'NIST AI RMF' | 'EU AI Act' | 'ISO/IEC 42001' | 'GDPR' | 'Other';
  /** Specific reference, e.g. "GOVERN 1.1" or "Article 14" */
  reference: string;
  /** One-sentence description of how this citation applies */
  description: string;
}

export interface DocumentSection {
  /** Section heading */
  heading: string;
  /** Narrative content for prose sections */
  content: string;
  /** Checklist items for checklist-style sections */
  checklistItems?: ChecklistItem[];
  /** Whether this section is mandatory for the document's risk tier */
  required: boolean;
}

export interface ChecklistItem {
  text: string;
  /** Whether the item is complete (for evidence pack population) */
  complete?: boolean;
  notes?: string;
}

export interface GovernanceDocument {
  documentType: DocumentType;
  title: string;
  riskTier: RiskTierLabel;
  /** Use case this document was generated for */
  useCaseName: string;
  sections: DocumentSection[];
  frameworkCitations: FrameworkCitation[];
  /** Recommended review cycle, e.g. "Annual" or "Quarterly" */
  reviewCycle: string;
  generatedAt: string;
  /** Full document formatted as markdown (ready for PDF export) */
  markdownExport: string;
}

// ─── Playbooks ────────────────────────────────────────────────────────────────

export type PlaybookFramework =
  | 'NIST AI RMF'
  | 'EU AI Act'
  | 'ISO/IEC 42001'
  | 'Combined'
  | 'GovSecure AI Chef'
  | 'GovSecure 90-Day Blueprint';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskOwner =
  | 'AI Governance Lead'
  | 'Business Owner'
  | 'Security Team'
  | 'Privacy/Legal'
  | 'IT/Engineering'
  | 'HR/Training'
  | 'Risk/Compliance'
  | 'Executive Sponsor';

export interface PlaybookTask {
  taskId: string;
  name: string;
  description: string;
  owner: TaskOwner;
  priority: TaskPriority;
  /** Estimated effort, e.g. "2–3 days" */
  effort: string;
  /** IDs of tasks that must complete before this one starts */
  dependsOn?: string[];
  /** NIST subcategory actions this task fulfils, e.g. ['MAP 1.1 Action 2'] */
  nistActions: string[];
  /** Tangible output produced by this task, e.g. "Completed risk register" */
  output: string;
}

export interface PlaybookPhase {
  phaseNumber: number;
  phaseName: string;
  /** Estimated duration for this phase, e.g. "2–4 weeks" */
  duration: string;
  objectives: string[];
  tasks: PlaybookTask[];
  /** Raw NIST section_actions text used to ground this phase */
  nistActionsSource: string[];
  /** Documents / deliverables produced in this phase */
  deliverables: string[];
  /** NIST section_doc requirements addressed by this phase */
  documentationRequirements: string[];
}

export interface PlaybookKPI {
  metric: string;
  target: string;
  measurementMethod: string;
  frequency: string;
}

export interface Playbook {
  title: string;
  framework: PlaybookFramework;
  riskTier: RiskTierLabel;
  useCaseName: string;
  /** Executive summary of the playbook */
  summary: string;
  phases: PlaybookPhase[];
  kpis: PlaybookKPI[];
  /** Total estimated duration across all phases, e.g. "8–12 weeks" */
  totalDuration: string;
  /** Framework versions referenced, e.g. ["NIST AI RMF 1.0", "EU AI Act 2024/1689"] */
  frameworkVersions: string[];
  generatedAt: string;
  /** Full playbook formatted as markdown (ready for PDF export) */
  markdownExport: string;
}

// ─── Evidence Pack ────────────────────────────────────────────────────────────

export type EvidencePackStatus = 'Complete' | 'Complete with Conditions' | 'Incomplete';

export interface EvidencePackItem {
  text: string;
  complete: boolean;
  evidenceLink?: string;
  notes?: string;
}

export interface EvidencePackSection {
  /** Section number 1–12 */
  sectionNumber: number;
  sectionName: string;
  items: EvidencePackItem[];
  /** Overall completeness for this section */
  completionStatus: 'Complete' | 'Partial' | 'Pending';
  notes?: string;
}

export interface EvidencePackSignOff {
  role: 'AI Governance' | 'Security' | 'Privacy' | 'Legal/Compliance' | 'Business Owner';
  name?: string;
  date?: string;
  signed: boolean;
}

export interface EvidencePack {
  // ── Cover ──────────────────────────────────────────────────────────────────
  useCaseName: string;
  useCaseId: string;
  businessOwner: string;
  aiGovernanceOwner: string;
  riskTier: RiskTierLabel;
  environment: 'Pilot' | 'Production' | 'Retired';
  evidencePackVersion: string;
  preparedBy: string;
  datePrepared: string;
  reviewPeriodCovered: string;

  // ── Sections ───────────────────────────────────────────────────────────────
  sections: EvidencePackSection[];

  // ── Final Review ──────────────────────────────────────────────────────────
  overallStatus: EvidencePackStatus;
  missingItems: string[];
  signOffs: EvidencePackSignOff[];

  generatedAt: string;
  /** Full evidence pack formatted as markdown (ready for PDF export) */
  markdownExport: string;
}