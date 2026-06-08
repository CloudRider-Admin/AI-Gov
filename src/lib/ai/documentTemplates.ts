// ─── Document Templates & Static Governance Structures ───────────────────────
// These are the authoritative static definitions passed as structured context
// to AI agents. They are grounded in:
//   • AI Intake Risk Assessment Checklist (Blueair template)
//   • AI Evidence Pack Checklist (Blueair template)
//   • NIST AI RMF 1.0 subcategory actions
//   • EU AI Act (2024/1689) articles
//   • ISO/IEC 42001:2023 clauses

import type { DocumentType, RiskTierLabel } from '@/types/documents';
import {
  GOVSECURE_DOCUMENT_TEMPLATES,
  GOVSECURE_DOCUMENT_TITLES,
} from '@/data/govsecurePolicies';
import {
  NIST_RCM_SECTION_TEMPLATES,
  PHASE3_DOCUMENT_TITLES,
  TPRM_SECTION_TEMPLATES,
} from '@/data/govsecurePlaybooks';

// ─── Risk Drivers ─────────────────────────────────────────────────────────────
// Verbatim from the AI Intake Risk Assessment Checklist template

export interface RiskDriverDefinition {
  id: string;
  label: string;
  subLabel: string;
  description: string;
  scoringGuidance: { 0: string; 1: string; 2: string; 3: string };
  nistMappings: string[];
  euAiActMappings: string[];
  iso42001Clauses: string[];
}

export const RISK_DRIVERS: RiskDriverDefinition[] = [
  {
    id: 'decision-impact',
    label: 'Decision Impact',
    subLabel: 'eligibility / pricing / hiring / claims / benefits',
    description: 'The degree to which AI outputs directly affect consequential decisions about people or organisations.',
    scoringGuidance: {
      0: 'No impact on decisions — purely informational or internal tool use.',
      1: 'Low-stakes decisions only; errors are easily corrected.',
      2: 'Outputs inform significant decisions but humans retain full control.',
      3: 'Automates or heavily influences high-stakes decisions (employment, credit, eligibility).',
    },
    nistMappings: ['MAP 1.1', 'MAP 1.5', 'MEASURE 2.1', 'MEASURE 2.2'],
    euAiActMappings: ['Article 6 (High-risk classification)', 'Annex III (High-risk AI categories)'],
    iso42001Clauses: ['8.4 (AI system impact assessment)', '6.1 (Actions to address risks)'],
  },
  {
    id: 'autonomy',
    label: 'Autonomy',
    subLabel: 'human-in-loop vs automated action',
    description: 'The level of autonomous action the AI takes without human review or intervention.',
    scoringGuidance: {
      0: 'Fully human-controlled; AI only surfaces information.',
      1: 'Human reviews all AI outputs before any action is taken.',
      2: 'Human-in-the-loop present but oversight may be partial or time-pressured.',
      3: 'AI acts autonomously with minimal or no human review at the point of action.',
    },
    nistMappings: ['GOVERN 1.3', 'MAP 1.5', 'MANAGE 2.2', 'MEASURE 2.5'],
    euAiActMappings: ['Article 14 (Human oversight)', 'Article 9(7) (Testing)'],
    iso42001Clauses: ['8.6 (AI system operation)', '9.1 (Monitoring and measurement)'],
  },
  {
    id: 'data-sensitivity',
    label: 'Data Sensitivity',
    subLabel: 'PII / PHI / PCI / minors / biometrics',
    description: 'The sensitivity of data the AI system processes, trains on, or produces.',
    scoringGuidance: {
      0: 'No personal data; purely aggregate or synthetic data.',
      1: 'Basic personal data with limited re-identification risk.',
      2: 'Personal data including contact details, location, or behavioural data (GDPR in scope).',
      3: 'Special category data: health, biometrics, minors, financial (PHI/PCI), or high re-identification risk.',
    },
    nistMappings: ['GOVERN 1.4', 'MAP 2.2', 'MANAGE 1.2', 'MEASURE 2.3'],
    euAiActMappings: ['Article 10 (Data governance)', 'GDPR Article 35 (DPIA requirement)'],
    iso42001Clauses: ['8.4.2 (Data for AI systems)', '4.2 (Interested parties)'],
  },
  {
    id: 'security-exposure',
    label: 'Security Exposure',
    subLabel: 'integrations, tool use, write-access, data retrieval',
    description: 'The attack surface and blast radius created by the AI system\'s integrations and access permissions.',
    scoringGuidance: {
      0: 'Fully isolated; no integrations, no external data access.',
      1: 'Read-only access to non-sensitive internal data; no external connections.',
      2: 'API integrations or broad data retrieval; limited write access.',
      3: 'Write access to production systems, tool use with elevated privileges, or MCP/agent integrations with broad reach.',
    },
    nistMappings: ['MEASURE 2.6', 'MANAGE 2.4', 'GOVERN 4.1', 'GOVERN 4.2'],
    euAiActMappings: ['Article 15 (Accuracy, robustness, cybersecurity)', 'Article 9(4) (Risk management)'],
    iso42001Clauses: ['8.5 (AI system security)', 'A.6 (AI system controls)'],
  },
  {
    id: 'regulatory-contract',
    label: 'Regulatory / Contract',
    subLabel: 'privacy laws, sector rules, customer commitments',
    description: 'Exposure to regulatory obligations, sector-specific rules, or contractual restrictions triggered by this AI system.',
    scoringGuidance: {
      0: 'No applicable sector regulations; minimal contractual implications.',
      1: 'Standard data protection obligations (GDPR/CCPA) apply but no high-risk processing.',
      2: 'Sector-specific regulations in scope (e.g. financial services, healthcare); customer DPAs relevant.',
      3: 'Multiple regulatory regimes apply; high-risk processing under GDPR; EU AI Act high-risk category likely.',
    },
    nistMappings: ['GOVERN 1.1', 'GOVERN 1.2', 'GOVERN 1.7', 'MAP 5.2'],
    euAiActMappings: ['Article 9 (Risk management system)', 'Article 17 (Quality management system)', 'Article 61 (Post-market monitoring)'],
    iso42001Clauses: ['4.1 (Understanding the organisation)', '6.1.2 (AI risk assessment)'],
  },
  {
    id: 'bias-discrimination',
    label: 'Bias / Discrimination',
    subLabel: 'protected classes, disparate impact',
    description: 'The risk that the AI system produces outputs that discriminate against or disproportionately harm protected groups.',
    scoringGuidance: {
      0: 'No interaction with protected characteristics; purely operational data.',
      1: 'Minimal demographic exposure; bias unlikely but should be monitored.',
      2: 'System interacts with data that may correlate with protected characteristics; bias testing required.',
      3: 'System directly influences decisions about people using data correlated with protected characteristics; fairness assessment mandatory.',
    },
    nistMappings: ['MEASURE 2.3', 'MANAGE 1.3', 'MAP 1.6', 'GOVERN 5.1'],
    euAiActMappings: ['Article 10(2)(f) (Bias examination in training data)', 'Article 13 (Transparency)'],
    iso42001Clauses: ['A.6.2.5 (Fairness)', '8.4 (AI system impact assessment)'],
  },
  {
    id: 'transparency-need',
    label: 'Transparency Need',
    subLabel: 'explainability, disclosures, contestability',
    description: 'The obligation to explain AI decisions to affected individuals and provide mechanisms to contest outcomes.',
    scoringGuidance: {
      0: 'Internal-only tool; no disclosure obligations.',
      1: 'Basic transparency adequate; staff are aware AI is involved.',
      2: 'Disclosure to external users or customers needed; explainability of outputs required.',
      3: 'Legal or regulatory obligation to explain decisions, provide contestability, or disclose AI involvement to affected individuals.',
    },
    nistMappings: ['GOVERN 5.1', 'GOVERN 5.2', 'MEASURE 2.8', 'MANAGE 4.1'],
    euAiActMappings: ['Article 13 (Transparency and provision of information)', 'Article 52 (Transparency obligations for certain AI systems)', 'GDPR Article 22 (Automated decision-making)'],
    iso42001Clauses: ['A.6.2.3 (Transparency)', '8.4 (AI system impact assessment)'],
  },
  {
    id: 'reliability-risk',
    label: 'Reliability Risk',
    subLabel: 'hallucinations, accuracy, drift, edge cases',
    description: 'The potential for AI system failures — including hallucinations, performance degradation, and unexpected outputs — to cause harm.',
    scoringGuidance: {
      0: 'Failures have no meaningful downstream impact.',
      1: 'Errors are caught quickly; low-stakes use case with easy correction.',
      2: 'Errors may propagate before detection; moderate stakes; drift possible over time.',
      3: 'High-stakes outputs acted on quickly; hallucinations or drift could cause significant harm; robust evaluation required.',
    },
    nistMappings: ['MEASURE 2.5', 'MEASURE 2.7', 'MANAGE 2.2', 'GOVERN 1.3'],
    euAiActMappings: ['Article 9 (Risk management system)', 'Article 15 (Accuracy, robustness, cybersecurity)', 'Article 72 (Post-market monitoring)'],
    iso42001Clauses: ['9.1 (Monitoring and measurement)', 'A.6.2.6 (Reliability and performance)'],
  },
  {
    id: 'vendor-supply-chain',
    label: 'Vendor / Supply Chain',
    subLabel: 'retention, training use, subcontractors, audit rights',
    description: 'Risks arising from reliance on third-party AI vendors, including data handling, contractual gaps, and lack of audit rights.',
    scoringGuidance: {
      0: 'Fully in-house; no third-party AI dependency.',
      1: 'Reputable vendor; clear DPA; no training use of client data confirmed.',
      2: 'Vendor DPA in place but some terms need clarification; subprocessor chain reviewed.',
      3: 'Vendor terms unclear on data retention or training use; no audit rights; subprocessors not fully known; no incident notification commitments.',
    },
    nistMappings: ['GOVERN 6.1', 'GOVERN 6.2', 'MAP 5.2', 'MANAGE 2.4'],
    euAiActMappings: ['Article 25 (Obligations of importers)', 'Article 28 (Obligations of deployers)', 'Article 53 (Obligations for GPAI model providers)'],
    iso42001Clauses: ['8.4.3 (Externally provided AI systems)', 'A.6.2.8 (Supply chain)'],
  },
  {
    id: 'reputational-risk',
    label: 'Reputational Risk',
    subLabel: 'brand exposure, harmful content',
    description: 'The potential for AI system outputs to damage brand reputation, generate harmful content, or erode stakeholder trust.',
    scoringGuidance: {
      0: 'Internal only; no brand exposure from AI outputs.',
      1: 'Limited external exposure; output review process in place.',
      2: 'Outputs may be shared externally or with customers; review process needed.',
      3: 'Public-facing outputs; high brand sensitivity; harmful content risk or politically sensitive use case.',
    },
    nistMappings: ['MAP 5.1', 'MANAGE 4.2', 'GOVERN 5.2', 'MEASURE 2.9'],
    euAiActMappings: ['Article 52 (Transparency obligations)', 'Article 50 (Obligations for providers and deployers of certain AI systems)'],
    iso42001Clauses: ['4.2 (Interested parties)', '6.1 (Actions to address risks)'],
  },
];

// ─── Auto-High Triggers ───────────────────────────────────────────────────────
// If ANY trigger fires, risk tier is automatically elevated to HIGH regardless of score.

export interface AutoHighTriggerDefinition {
  id: string;
  description: string;
  /** Explanation of why this trigger mandates HIGH tier */
  rationale: string;
}

export const AUTO_HIGH_TRIGGERS: AutoHighTriggerDefinition[] = [
  {
    id: 'people-decisions',
    description: 'Automates or materially influences decisions about people (employment, credit, claims, pricing, eligibility)',
    rationale: 'Direct impact on individuals\' rights and livelihoods mandates the highest level of governance scrutiny regardless of overall score.',
  },
  {
    id: 'regulated-data',
    description: 'Uses regulated data (PHI / PCI) or sensitive personal data (biometrics / minors)',
    rationale: 'Processing of regulated or special-category data triggers specific legal obligations under GDPR, HIPAA, and EU AI Act that require high-tier controls.',
  },
  {
    id: 'public-facing-genai',
    description: 'Public-facing or customer-facing generative output',
    rationale: 'Generative AI outputs visible to the public or customers create significant reputational, legal, and safety risks requiring high-tier oversight.',
  },
  {
    id: 'write-access',
    description: 'Connects to internal systems with write access or broad data retrieval',
    rationale: 'Write access or broad data retrieval creates a large blast radius in the event of prompt injection, compromise, or model error.',
  },
  {
    id: 'vendor-terms-gap',
    description: 'Vendor terms unclear on data retention / training or no audit / incident rights',
    rationale: 'Without clear data handling commitments and audit rights, the organisation cannot adequately manage or demonstrate compliance with its data protection obligations.',
  },
  {
    id: 'no-monitoring',
    description: 'No logging / monitoring feasible (can\'t measure failures or usage)',
    rationale: 'Without logging and monitoring, the organisation cannot detect failures, measure performance, or demonstrate compliance — a fundamental governance requirement.',
  },
];

// ─── Tier-Based Required Artifacts ────────────────────────────────────────────
// Cumulative: High includes Medium, Medium includes Low.

export interface ArtifactDefinition {
  name: string;
  description: string;
  minimumTier: RiskTierLabel;
}

export const TIER_ARTIFACTS: ArtifactDefinition[] = [
  // ── Tier 1 — LOW (required for all tiers) ──────────────────────────────────
  { name: 'Use Case Summary', description: 'Purpose, intended users, workflow description, and system boundaries.', minimumTier: 'Low' },
  { name: 'Data Sheet', description: 'Data types processed, sources, retention periods, and access controls.', minimumTier: 'Low' },
  { name: 'Vendor / Model Facts', description: 'Vendor name, model version, hosting location, and API version.', minimumTier: 'Low' },
  { name: 'Basic Security Review', description: 'Access control review confirming least privilege and authentication controls.', minimumTier: 'Low' },
  { name: 'Evaluation Plan — Lite', description: 'Basic accuracy and prompt testing plan for GenAI; performance baseline for ML.', minimumTier: 'Low' },
  { name: 'Monitoring Plan — Lite', description: 'Usage logging approach and incident routing procedure.', minimumTier: 'Low' },
  { name: 'Human Oversight Statement', description: 'Statement defining who reviews AI outputs, when, and what escalation paths exist.', minimumTier: 'Low' },

  // ── Tier 2 — MEDIUM (adds to Low) ─────────────────────────────────────────
  { name: 'DPIA / Privacy Impact Assessment', description: 'Data Protection Impact Assessment or equivalent privacy risk assessment.', minimumTier: 'Medium' },
  { name: 'Threat Model — Lite', description: 'Lightweight threat model covering prompt injection, data leakage, and abuse paths.', minimumTier: 'Medium' },
  { name: 'Model Card — Standard', description: 'Intended use, known limitations, risks, training data summary, and version information.', minimumTier: 'Medium' },
  { name: 'Evaluation Plan — Standard', description: 'Quality and bias checks, red-team prompts for GenAI, performance benchmarks.', minimumTier: 'Medium' },
  { name: 'Monitoring Plan — Standard', description: 'Drift and hallucination tracking, performance alerts, and periodic review cadence.', minimumTier: 'Medium' },
  { name: 'Human-in-the-Loop Design', description: 'Documented decision points where human review is required, override procedures, and escalation paths.', minimumTier: 'Medium' },
  { name: 'Third-Party Risk Review', description: 'Vendor DPA review, data retention and training use confirmation, subprocessor list, incident notification commitments, and audit rights.', minimumTier: 'Medium' },

  // ── Tier 3 — HIGH (adds to Medium) ────────────────────────────────────────
  { name: 'Formal Risk Assessment Memo', description: 'Documented analysis of what can go wrong, proposed mitigations, and residual risk rating.', minimumTier: 'High' },
  { name: 'Full Threat Model & Security Test Evidence', description: 'Comprehensive threat model with abuse testing, prompt injection defences, and access control evidence.', minimumTier: 'High' },
  { name: 'Bias / Fairness Assessment', description: 'Assessment of model fairness across protected characteristics with mitigation plan (required if people-impacting).', minimumTier: 'High' },
  { name: 'Explainability & Notice Plan', description: 'Plan for disclosures, explanation of AI decision logic, and contestability / appeals process where relevant.', minimumTier: 'High' },
  { name: 'Robust Evaluation Report', description: 'Benchmarking results, failure mode documentation, and acceptance thresholds with go/no-go criteria.', minimumTier: 'High' },
  { name: 'Operational Readiness Plan', description: 'Standard operating procedures, incident runbook, rollback plan, and model change control process.', minimumTier: 'High' },
  { name: 'Monitoring & Audit Evidence Plan', description: 'Logging strategy, retention periods, periodic review schedule, and audit evidence collection plan.', minimumTier: 'High' },
  { name: 'Legal Review Sign-off', description: 'Legal review confirming contracts, regulatory obligations, and customer commitments are satisfied.', minimumTier: 'High' },
];

/** Return the cumulative artifact list for a given tier */
export function getArtifactsForTier(tier: RiskTierLabel): ArtifactDefinition[] {
  const tierOrder: RiskTierLabel[] = ['Low', 'Medium', 'High', 'Critical'];
  const tierIndex = tierOrder.indexOf(tier);
  return TIER_ARTIFACTS.filter(a => tierOrder.indexOf(a.minimumTier) <= tierIndex);
}

// ─── Document Section Templates ───────────────────────────────────────────────
// Section headings and content guidance per document type.

export interface SectionTemplate {
  heading: string;
  guidance: string;
  required: boolean;
  /** If true, this section uses checklist items rather than prose */
  isChecklist?: boolean;
  /**
   * Phase 2.5 brand-voice anchor. Original GovSecure prose for the source
   * section, used as a few-shot exemplar by the DocumentOrchestrator. May
   * be undefined for non-GovSecure templates.
   */
  govsecureContext?: string;
  /** GovSecure document code the template was derived from, e.g. `GS-AIPS-AUP-01`. */
  sourceDocCode?: string;
  /** Section id within the source document, e.g. `1.2`. */
  sourceSection?: string;
}

export const DOCUMENT_SECTION_TEMPLATES: Record<DocumentType, SectionTemplate[]> = {
  'use-case-summary': [
    { heading: 'Use Case Overview', guidance: 'Describe the AI use case: the business problem it solves, the model type, and how it works at a high level.', required: true },
    { heading: 'System Owner & Accountability', guidance: 'Name the accountable owner for the use case and the team responsible for operating it.', required: true },
    { heading: 'Risk Summary', guidance: 'Summarise the risk tier and the principal risks; state plainly when the use case is high risk.', required: true },
    { heading: 'Stakeholders & Affected Parties', guidance: 'List who operates the system and the stakeholders affected by its outputs (e.g. recruiters, applicants, customers).', required: true },
    { heading: 'Decision Type & Automation', guidance: 'Describe the type of decision the AI informs or makes and the degree of automation versus human control.', required: true },
    { heading: 'Data Description', guidance: 'Describe the data the system processes, its sources, and sensitivity.', required: true },
    { heading: 'Human Review & Oversight', guidance: 'Describe the human review applied to AI outputs before action, and who performs it.', required: true },
    { heading: 'Known Limitations & Prohibited Uses', guidance: 'Document known model limitations and explicitly prohibited use cases.', required: true },
  ],
  'data-sheet': [
    { heading: 'Data Types Processed', guidance: 'List all data types: personal data categories, special category data, and non-personal data.', required: true },
    { heading: 'Data Sources', guidance: 'Identify all data sources — internal systems, external APIs, user input, etc.', required: true },
    { heading: 'Data Flow Diagram Description', guidance: 'Describe the data flow: source → processing → storage → output → deletion.', required: true },
    { heading: 'Retention & Deletion', guidance: 'State retention periods for each data type and deletion procedures.', required: true },
    { heading: 'Access Controls', guidance: 'List who has access to what data and under what conditions.', required: true },
    { heading: 'Data Minimisation Measures', guidance: 'Describe how data collection is limited to what is necessary.', required: true },
    { heading: 'Cross-Border Transfer Assessment', guidance: 'Identify any cross-border data transfers and the legal basis for each.', required: false },
  ],
  'vendor-model-facts': [
    { heading: 'Vendor Information', guidance: 'Vendor name, registered address, and primary contact.', required: true },
    { heading: 'Model Details', guidance: 'Model name, version, API version, and release date.', required: true },
    { heading: 'Hosting & Data Residency', guidance: 'Where is the model hosted? Which regions? What data residency guarantees exist?', required: true },
    { heading: 'Data Handling Commitments', guidance: 'Does the vendor use customer data for training? What is the retention policy? Is there a DPA?', required: true },
    { heading: 'Security Certifications', guidance: 'List vendor security certifications: SOC 2, ISO 27001, etc.', required: true },
    { heading: 'Subprocessors', guidance: 'List known subprocessors and their roles.', required: true },
    { heading: 'Incident Notification Commitments', guidance: 'What are the vendor\'s obligations to notify in case of a security incident?', required: true },
    { heading: 'Audit Rights', guidance: 'Does the contract include audit rights? How can the organisation verify compliance?', required: true },
    { heading: 'SLA & Service Dependencies', guidance: 'Key SLA commitments and service availability dependencies.', required: false },
  ],
  'threat-model': [
    { heading: 'Threat Model Scope', guidance: 'Define the scope: which components, integrations, and data flows are in scope.', required: true },
    { heading: 'Threat Actors & Attack Vectors', guidance: 'Identify plausible threat actors and their motivations.', required: true },
    { heading: 'Prompt Injection Risks', guidance: 'For GenAI systems: identify prompt injection vectors and defences.', required: true },
    { heading: 'Data Leakage Paths', guidance: 'Identify paths by which sensitive data could be exposed through model outputs.', required: true },
    { heading: 'Abuse Paths', guidance: 'Document misuse scenarios: jailbreaks, unauthorised access, data extraction.', required: true },
    { heading: 'Access Control Gaps', guidance: 'Identify gaps in authentication, authorisation, and least-privilege enforcement.', required: true },
    { heading: 'Mitigations & Controls', guidance: 'Document controls implemented to address each identified threat.', required: true },
    { heading: 'Residual Risks', guidance: 'List residual risks after controls are applied and their accepted risk level.', required: true },
  ],
  'human-oversight-statement': [
    { heading: 'Oversight Roles & Responsibilities', guidance: 'Name the roles responsible for reviewing AI outputs at each stage.', required: true },
    { heading: 'Review Trigger Conditions', guidance: 'Define when human review is mandatory vs. discretionary.', required: true },
    { heading: 'Override & Correction Procedures', guidance: 'Describe how reviewers can override, correct, or reject AI outputs.', required: true },
    { heading: 'Escalation Path', guidance: 'Define the escalation path for incorrect, harmful, or uncertain outputs.', required: true },
    { heading: 'Fallback Procedures', guidance: 'What happens when the AI system is unavailable or producing unreliable outputs?', required: true },
    { heading: 'Training & Awareness', guidance: 'What training is provided to staff who review or act on AI outputs?', required: true },
    { heading: 'Accountability Matrix', guidance: 'Map accountability across business, IT, security, privacy, legal, and governance functions.', required: true },
  ],
  'dpia': [
    { heading: 'Processing Description & Lawful Basis', guidance: 'Describe the nature, scope, context, and purposes of the AI-related processing, and state the lawful basis for it under the GDPR.', required: true },
    { heading: 'Necessity & Proportionality', guidance: 'Is the processing necessary for the stated purpose? Is it proportionate to the risk?', required: true },
    { heading: 'Risks to Individuals', guidance: 'Identify risks to the rights and freedoms of data subjects: privacy, discrimination, and loss of control over personal data.', required: true },
    { heading: 'Likelihood & Severity Assessment', guidance: 'For each risk: assess likelihood (1–5) and severity (1–5); calculate the risk score.', required: true },
    { heading: 'Mitigations', guidance: 'Document the technical and organisational mitigation measures applied to each identified risk.', required: true },
    { heading: 'Data Subject Rights', guidance: 'Explain how data subject rights under the GDPR (access, rectification, erasure, objection, and rights around automated decisions) are upheld.', required: true },
    { heading: 'Residual Risk & Acceptability', guidance: 'After mitigations: is residual risk acceptable? Is supervisory authority consultation required?', required: true },
    { heading: 'Consultation', guidance: 'Record consultations with the DPO, data subjects, or the supervisory authority where applicable.', required: false },
    { heading: 'Review & Update Commitment', guidance: 'Commit to reviewing the DPIA when the processing changes significantly.', required: true },
  ],
  'model-card': [
    { heading: 'Model Overview', guidance: 'Model type, version, provider, and primary purpose.', required: true },
    { heading: 'Intended Use', guidance: 'Describe intended users, use cases, and deployment contexts.', required: true },
    { heading: 'Out-of-Scope Uses', guidance: 'Explicitly list uses for which the model is not intended or tested.', required: true },
    { heading: 'Training Data Summary', guidance: 'Summary of training data: sources, date ranges, known characteristics, and potential biases.', required: true },
    { heading: 'Performance Metrics', guidance: 'Key performance metrics and evaluation results on relevant benchmarks.', required: true },
    { heading: 'Limitations & Known Failure Modes', guidance: 'Document known limitations, edge cases, and failure modes.', required: true },
    { heading: 'Bias & Fairness Evaluation', guidance: 'Describe bias evaluation conducted and any identified disparities.', required: true },
    { heading: 'Ethical Considerations', guidance: 'Document ethical considerations relevant to the model\'s use.', required: true },
  ],
  'risk-memo': [
    { heading: 'Executive Summary', guidance: 'One-paragraph summary of the use case, risk tier, and key findings.', required: true },
    { heading: 'Risk Identification', guidance: 'List identified risks across technical, operational, regulatory, and reputational dimensions.', required: true },
    { heading: 'Risk Scoring', guidance: 'Score each risk by likelihood (1–5) × impact (1–5); categorise as Low/Medium/High/Critical.', required: true },
    { heading: 'Root Cause Analysis', guidance: 'For High/Critical risks: identify root causes and contributing factors.', required: true },
    { heading: 'Proposed Mitigations', guidance: 'For each risk: document the proposed mitigation, owner, and target date.', required: true },
    { heading: 'Residual Risk', guidance: 'After mitigations: what is the residual risk level? Is it acceptable?', required: true },
    { heading: 'Risk Treatment Decision', guidance: 'Accept / Mitigate / Transfer / Avoid — with rationale for each significant risk.', required: true },
    { heading: 'Open Items & Conditions', guidance: 'List any unresolved issues that must be addressed before go-live.', required: true },
  ],
  'operational-readiness-plan': [
    { heading: 'Go-Live Readiness Criteria', guidance: 'Define the criteria that must be met before the system is deployed to production.', required: true },
    { heading: 'Standard Operating Procedures', guidance: 'Document SOPs for routine operation, maintenance, and user support.', required: true },
    { heading: 'Incident Runbook', guidance: 'Step-by-step response procedures for AI system failures, harmful outputs, and security incidents.', required: true },
    { heading: 'Rollback Plan', guidance: 'Procedure to disable or roll back the AI system if critical issues arise post-deployment.', required: true },
    { heading: 'Model Change Control', guidance: 'Process for managing model updates, vendor releases, and integration changes.', required: true },
    { heading: 'On-Call & Escalation Contacts', guidance: 'List of contacts for incident response, escalation, and vendor support.', required: true },
    { heading: 'Training Completion Evidence', guidance: 'Confirm that all relevant staff have completed required training before go-live.', required: true },
  ],
  'monitoring-plan': [
    { heading: 'Monitoring Objectives', guidance: 'Define what the monitoring programme aims to detect and prevent.', required: true },
    { heading: 'Metrics & Thresholds', guidance: 'List metrics to be monitored and the thresholds that trigger alerts or review.', required: true },
    { heading: 'Logging & Telemetry', guidance: 'Describe what is logged, where logs are stored, and retention period.', required: true },
    { heading: 'Drift & Performance Review', guidance: 'Define the schedule and process for reviewing model performance drift.', required: true },
    { heading: 'Incident Tracking', guidance: 'Describe how incidents, near-misses, and user complaints are tracked and resolved.', required: true },
    { heading: 'Periodic Review Cadence', guidance: 'Define the schedule for formal periodic reviews (quarterly / annual).', required: true },
    { heading: 'Re-assessment Triggers', guidance: 'List events that trigger a full re-assessment: model changes, new data sources, new geographies, new features.', required: true },
    { heading: 'Audit Evidence Collection', guidance: 'Describe how monitoring evidence is collected and preserved for audit purposes.', required: true },
  ],
  'evidence-pack': [
    { heading: 'Evidence Pack Cover & Index', guidance: 'Cover page with use case name, version, date, owners, and table of contents.', required: true, isChecklist: true },
    { heading: 'Use Case Authorization & Intake Evidence', guidance: 'Intake form, business justification, scope definition, triage outcome, approvals.', required: true, isChecklist: true },
    { heading: 'Governance & Policy Compliance Evidence', guidance: 'Policy applicability, standards identified, control mapping, compliance requirements.', required: true, isChecklist: true },
    { heading: 'Risk Assessment & Triage Evidence', guidance: 'Completed risk assessment, residual risk rating, risk treatment plan, owners.', required: true, isChecklist: true },
    { heading: 'Privacy & Data Protection Evidence', guidance: 'Data classification, data flow, lawful basis, DPIA, cross-border transfers.', required: true, isChecklist: true },
    { heading: 'Security Control Evidence', guidance: 'Security architecture review, auth controls, logging, encryption, threat model.', required: true, isChecklist: true },
    { heading: 'Model / System Documentation Evidence', guidance: 'Model description, source, model card, training data summary, version info.', required: true, isChecklist: true },
    { heading: 'Vendor / Third-Party Evidence', guidance: 'Vendor risk assessment, contract review, security docs, retention terms, subprocessors.', required: false, isChecklist: true },
    { heading: 'Testing, Validation & Quality Evidence', guidance: 'Test plan, functional testing, evaluation metrics, UAT, go-live readiness.', required: true, isChecklist: true },
    { heading: 'Monitoring & Operations Evidence', guidance: 'Monitoring plan, logging evidence, drift schedule, incident tracking, change management.', required: true, isChecklist: true },
    { heading: 'Human Oversight & Accountability Evidence', guidance: 'Reviewer roles, escalation path, override process, training, accountability matrix.', required: true, isChecklist: true },
    { heading: 'Audit Readiness & Traceability Checks', guidance: 'All artifacts present, dates current, evidence traceable, approvals signed, next review date.', required: true, isChecklist: true },
  ],
  // Phase 2: 22 GovSecure-licensed document types loaded from the
  // extracted JSON corpus. Each entry contains the original heading,
  // distilled guidance, and the source prose for voice-anchoring (Phase 2.5).
  ...GOVSECURE_DOCUMENT_TEMPLATES,
  // Phase 3: GovSecure flagship questionnaires + framework templates.
  // TPRM: one-shot generation today; Phase 3.5 will route this through the
  // multi-turn WorkflowOrchestrator. NIST-RCM: row-per-control rollup
  // derived from the Risk Control Matrix v5 spreadsheet.
  'govsecure-tprm': TPRM_SECTION_TEMPLATES,
  'govsecure-nist-rcm': NIST_RCM_SECTION_TEMPLATES,
};

/**
 * Display titles per document type — used by the DocumentOrchestrator and
 * UI. GovSecure types are sourced from the licensed naming in
 * `govsecurePolicies.ts`; generic types keep the original short labels.
 */
export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  'use-case-summary': 'Use Case Summary',
  'data-sheet': 'Data Sheet',
  'vendor-model-facts': 'Vendor / Model Facts Sheet',
  'threat-model': 'Threat Model',
  'human-oversight-statement': 'Human Oversight Statement',
  'dpia': 'Data Protection Impact Assessment (DPIA)',
  'model-card': 'Model Card',
  'risk-memo': 'Risk Memo',
  'operational-readiness-plan': 'Operational Readiness Plan',
  'monitoring-plan': 'Monitoring Plan',
  'evidence-pack': 'Evidence Pack',
  ...GOVSECURE_DOCUMENT_TITLES,
  ...PHASE3_DOCUMENT_TITLES,
};

// ─── Evidence Pack Checklist Items ────────────────────────────────────────────
// Verbatim from the AI Evidence Pack Checklist template (Blueair).

export const EVIDENCE_PACK_CHECKLIST_ITEMS: Record<number, string[]> = {
  1: [
    'Cover page with use case name, version, date, owners',
    'Evidence pack table of contents / index included',
    'Document control/version history included',
    'Links/locations to source evidence included (SharePoint, GRC tool, ticket system, etc.)',
    'Evidence pack completeness status documented (Complete / Partial / Pending)',
  ],
  2: [
    'AI Use Case Intake Form (completed)',
    'Business justification / problem statement',
    'Scope definition (pilot / production / affected users)',
    'Triage outcome and risk tier assignment',
    'Approval record(s) for intake / launch decision',
    'Exception record(s), if any (with expiry date and compensating controls)',
  ],
  3: [
    'AI Governance Policy applicability confirmation',
    'Applicable standards/procedures identified',
    'Control mapping (policy/standard → implemented controls)',
    'Compliance requirements identified (privacy, cyber, sector, contract, etc.)',
    'Policy exception or deviation approval (if applicable)',
    'Governance review meeting minutes / decision log (if used)',
  ],
  4: [
    'AI risk assessment completed (scoring + rationale)',
    'Technology/security risk assessment completed',
    'Compliance risk register entry created/updated',
    'Residual risk rating documented',
    'Risk treatment plan documented (accept / mitigate / transfer / avoid)',
    'Risk owner and due dates assigned',
  ],
  5: [
    'Data classification documented (PII/PHI/PCI/etc.)',
    'Data flow documented (source → processing → storage → output)',
    'Lawful basis / privacy basis identified (if applicable)',
    'DPIA/PIA completed (if required)',
    'Cross-border data transfer assessment completed (if applicable)',
    'Data minimization and retention requirements documented',
    'Privacy notice / consent impact assessment completed (if applicable)',
    'DPA / privacy terms reviewed (for vendor AI)',
  ],
  6: [
    'Security architecture review completed',
    'Authentication / SSO / MFA controls documented',
    'Access controls and roles approved (least privilege)',
    'Logging and audit trail enabled',
    'Encryption in transit / at rest confirmed (if applicable)',
    'Secrets / API key management documented',
    'Vulnerability/security testing evidence (as applicable)',
    'Threat model completed (required for high/critical risk)',
    'Incident response contacts and escalation path documented',
    'DLP / prompt handling controls documented (if applicable)',
  ],
  7: [
    'Model/system description documented (type, purpose, limitations)',
    'Model source identified (internal / vendor / OSS / API)',
    'Model card or equivalent documentation (if applicable)',
    'Training data/source summary documented (if applicable)',
    'Version information captured (model version, vendor release, API version)',
    'Known limitations / prohibited uses documented',
    'Human oversight requirements documented',
  ],
  8: [
    'Vendor risk assessment completed',
    'Contract / MSA / DPA reviewed and approved',
    'Vendor security documentation collected (SOC 2 / ISO / etc.)',
    'Data retention/training usage terms confirmed',
    'Subprocessor list reviewed',
    'Incident notification commitments confirmed',
    'Hosting region / data residency confirmed',
    'SLA / service dependency documented',
  ],
  9: [
    'Test plan approved before go-live',
    'Functional testing results documented',
    'Evaluation metrics defined and recorded (accuracy, precision, relevance, etc.)',
    'Failure mode testing / edge cases documented',
    'Hallucination/error handling evaluation (for GenAI)',
    'Bias/fairness assessment completed (if applicable)',
    'User acceptance testing (UAT) evidence included',
    'Go-live readiness decision documented',
  ],
  10: [
    'Monitoring plan documented (what is monitored + thresholds)',
    'Logging/telemetry evidence available',
    'Drift/performance review schedule defined (if applicable)',
    'Incident/issue tracking process documented',
    'Periodic review cadence defined (annual / quarterly / etc.)',
    'Change management process for model/vendor updates documented',
    'Re-approval/reauthorization trigger criteria documented',
  ],
  11: [
    'Human reviewer role(s) identified',
    'Escalation path for incorrect/harmful outputs documented',
    'Override/fallback process documented',
    'Training/awareness provided to users/reviewers',
    'Accountability matrix (business, IT, security, privacy, legal, governance) documented',
  ],
  12: [
    'All required artifacts present for assigned risk tier',
    'Dates and versions are current (no expired approvals)',
    'Evidence is traceable to source systems (no screenshots only, where better evidence exists)',
    'Approvals are signed/attributable (name + date)',
    'Open issues/exceptions are clearly listed and linked',
    'Next review date recorded',
    'Retention location and retention period documented',
  ],
};

// ─── NIST Subcategory to Risk Driver Mapping ──────────────────────────────────

export const DRIVER_NIST_MAPPING: Record<string, string[]> = {
  'decision-impact':      ['MAP 1.1', 'MAP 1.5', 'MEASURE 2.1', 'MEASURE 2.2'],
  'autonomy':             ['GOVERN 1.3', 'MAP 1.5', 'MANAGE 2.2', 'MEASURE 2.5'],
  'data-sensitivity':     ['GOVERN 1.4', 'MAP 2.2', 'MANAGE 1.2', 'MEASURE 2.3'],
  'security-exposure':    ['MEASURE 2.6', 'MANAGE 2.4', 'GOVERN 4.1', 'GOVERN 4.2'],
  'regulatory-contract':  ['GOVERN 1.1', 'GOVERN 1.2', 'GOVERN 1.7', 'MAP 5.2'],
  'bias-discrimination':  ['MEASURE 2.3', 'MANAGE 1.3', 'MAP 1.6', 'GOVERN 5.1'],
  'transparency-need':    ['GOVERN 5.1', 'GOVERN 5.2', 'MEASURE 2.8', 'MANAGE 4.1'],
  'reliability-risk':     ['MEASURE 2.5', 'MEASURE 2.7', 'MANAGE 2.2', 'GOVERN 1.3'],
  'vendor-supply-chain':  ['GOVERN 6.1', 'GOVERN 6.2', 'MAP 5.2', 'MANAGE 2.4'],
  'reputational-risk':    ['MAP 5.1', 'MANAGE 4.2', 'GOVERN 5.2', 'MEASURE 2.9'],
};

// ─── EU AI Act Article to Risk Driver Mapping ─────────────────────────────────

export const DRIVER_EU_AI_ACT_MAPPING: Record<string, string[]> = {
  'decision-impact':      ['Article 6 (High-risk classification)', 'Annex III (High-risk categories)'],
  'autonomy':             ['Article 14 (Human oversight)', 'Article 9(7) (Testing procedures)'],
  'data-sensitivity':     ['Article 10 (Data governance)', 'GDPR Article 35 (DPIA)'],
  'security-exposure':    ['Article 15 (Accuracy, robustness, cybersecurity)', 'Article 9(4)(b) (Risk management)'],
  'regulatory-contract':  ['Article 9 (Risk management system)', 'Article 17 (Quality management system)'],
  'bias-discrimination':  ['Article 10(2)(f) (Examination for biases)', 'Article 13 (Transparency)'],
  'transparency-need':    ['Article 13 (Transparency and provision of information)', 'Article 52 (Transparency obligations)'],
  'reliability-risk':     ['Article 9 (Risk management system)', 'Article 15 (Robustness)', 'Article 72 (Post-market monitoring)'],
  'vendor-supply-chain':  ['Article 25 (Obligations of importers)', 'Article 28 (Obligations of deployers)', 'Article 53 (GPAI obligations)'],
  'reputational-risk':    ['Article 52 (Transparency obligations)', 'Article 50 (Obligations for certain AI systems)'],
};

// ─── Playbook Phase Templates per Framework ───────────────────────────────────

export interface PlaybookPhaseTemplate {
  phaseNumber: number;
  phaseName: string;
  durationGuide: { Low: string; Medium: string; High: string };
  objectives: string[];
  nistSubcategories: string[];
  euAiActArticles?: string[];
  iso42001Clauses?: string[];
}

export const NIST_PLAYBOOK_PHASES: PlaybookPhaseTemplate[] = [
  {
    phaseNumber: 1,
    phaseName: 'GOVERN — Foundation & Policy',
    durationGuide: { Low: '1–2 weeks', Medium: '2–3 weeks', High: '3–4 weeks' },
    objectives: [
      'Establish AI governance structure and accountability',
      'Define risk tolerance and governance policies',
      'Identify regulatory obligations and legal requirements',
      'Assign roles and responsibilities',
    ],
    nistSubcategories: ['GOVERN 1.1', 'GOVERN 1.2', 'GOVERN 1.3', 'GOVERN 2.1', 'GOVERN 2.2', 'GOVERN 3.1'],
    euAiActArticles: ['Article 9 (Risk management system)', 'Article 17 (Quality management system)'],
    iso42001Clauses: ['4.1', '4.2', '5.1', '5.2', '6.1', '7.1'],
  },
  {
    phaseNumber: 2,
    phaseName: 'MAP — Risk Identification',
    durationGuide: { Low: '1 week', Medium: '2 weeks', High: '2–3 weeks' },
    objectives: [
      'Categorise and document the AI use case',
      'Identify all affected stakeholders',
      'Map technical and operational risks',
      'Assess impact on individuals and organisations',
    ],
    nistSubcategories: ['MAP 1.1', 'MAP 1.5', 'MAP 1.6', 'MAP 2.1', 'MAP 2.2', 'MAP 5.1', 'MAP 5.2'],
    euAiActArticles: ['Article 6 (Classification)', 'Article 10 (Data governance)', 'Annex III'],
    iso42001Clauses: ['6.1.2', '8.4', '8.5'],
  },
  {
    phaseNumber: 3,
    phaseName: 'MEASURE — Assessment & Testing',
    durationGuide: { Low: '1–2 weeks', Medium: '2–3 weeks', High: '3–5 weeks' },
    objectives: [
      'Develop and apply evaluation metrics',
      'Conduct bias and fairness assessment',
      'Complete security and privacy testing',
      'Validate human oversight mechanisms',
    ],
    nistSubcategories: ['MEASURE 2.1', 'MEASURE 2.3', 'MEASURE 2.5', 'MEASURE 2.6', 'MEASURE 2.7', 'MEASURE 2.8'],
    euAiActArticles: ['Article 9(7) (Testing)', 'Article 15 (Robustness)', 'Article 10(2)(f) (Bias)'],
    iso42001Clauses: ['8.4', '9.1', '9.2'],
  },
  {
    phaseNumber: 4,
    phaseName: 'MANAGE — Controls & Deployment',
    durationGuide: { Low: '1 week', Medium: '1–2 weeks', High: '2–3 weeks' },
    objectives: [
      'Implement risk mitigation controls',
      'Complete documentation and evidence collection',
      'Obtain required approvals and sign-offs',
      'Deploy to production with monitoring active',
    ],
    nistSubcategories: ['MANAGE 1.1', 'MANAGE 1.2', 'MANAGE 1.3', 'MANAGE 2.2', 'MANAGE 2.4', 'MANAGE 4.1', 'MANAGE 4.2'],
    euAiActArticles: ['Article 13 (Transparency)', 'Article 14 (Human oversight)', 'Article 17 (QMS)'],
    iso42001Clauses: ['8.6', '9.3', '10.1', '10.2'],
  },
  {
    phaseNumber: 5,
    phaseName: 'MONITOR — Ongoing Governance',
    durationGuide: { Low: 'Ongoing (quarterly review)', Medium: 'Ongoing (monthly review)', High: 'Ongoing (monthly review + annual audit)' },
    objectives: [
      'Operate continuous monitoring and alerting',
      'Conduct periodic performance and drift reviews',
      'Manage model updates and vendor changes',
      'Maintain audit evidence and evidence pack',
    ],
    nistSubcategories: ['GOVERN 1.4', 'MANAGE 2.2', 'MEASURE 2.7', 'MEASURE 2.9', 'MANAGE 4.2'],
    euAiActArticles: ['Article 61 (Post-market monitoring)', 'Article 72 (Serious incident reporting)'],
    iso42001Clauses: ['9.1', '9.2', '9.3', '10.1'],
  },
];