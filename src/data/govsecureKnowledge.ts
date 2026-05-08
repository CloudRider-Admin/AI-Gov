/**
 * GovSecure Knowledge — Typed Loader
 *
 * Imports the bundled index produced by `scripts/ingestGovSecureLibrary.py`
 * (Phase 0) and exposes typed accessors plus higher-level domain models.
 *
 * Companion to:
 *   - src/types/govsecure.ts   (type definitions)
 *   - src/data/govsecureContent/  (per-document JSON, generated)
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.1
 */

import bundledIndex from './govsecureContent/index.json';
import type {
  ExtractedDocument,
  GovSecureCategory,
  GovSecureRiskTier,
  ManifestEntry,
  NISTControl,
  PolicyEntry,
  PolicySuiteMap,
  PolicySuiteTier,
  RiskTierModel,
} from '@/types/govsecure';

// ─── Bundled index (raw JSON cast to typed shape) ───────────────────────────

interface BundledIndex {
  generatedAt: string;
  documentCount: number;
  documents: Record<string, ExtractedDocument>;
}

const INDEX = bundledIndex as unknown as BundledIndex;

/** All extracted GovSecure documents, keyed by documentCode (e.g. "GS-AIPS-GOVERNAN-03"). */
export const GOVSECURE_DOCUMENTS: Record<string, ExtractedDocument> = INDEX.documents;

/** Master list of every extracted document. */
export const GOVSECURE_DOCUMENT_LIST: ExtractedDocument[] = Object.values(INDEX.documents);

/** When the source library was last extracted. */
export const GOVSECURE_GENERATED_AT = INDEX.generatedAt;

// ─── Document accessors ─────────────────────────────────────────────────────

/**
 * Find a document by its `documentCode` (e.g. "GS-AIPS-GOVERNAN-03").
 * Returns `undefined` if the code is unknown.
 */
export function getDocumentByCode(code: string): ExtractedDocument | undefined {
  return GOVSECURE_DOCUMENTS[code];
}

/**
 * Find a document by `category` + `subType`. The pair is unique within the
 * library for canonical documents (duplicates produced by the extractor get
 * a different `subType` like "ai-chef-toolkit-noncustom" vs "ai-chef-toolkit").
 */
export function getDocumentBySubType(
  category: GovSecureCategory,
  subType: string,
): ExtractedDocument | undefined {
  return GOVSECURE_DOCUMENT_LIST.find(
    (d) => d.category === category && d.subType === subType,
  );
}

/** All documents in a category (e.g. all 11 policies, all 28 checklists). */
export function getDocumentsByCategory(category: GovSecureCategory): ExtractedDocument[] {
  return GOVSECURE_DOCUMENT_LIST.filter((d) => d.category === category);
}

/** All policy documents (Core 8 + Suite Map + Offering Guide variants). */
export function getAllPolicies(): ExtractedDocument[] {
  return getDocumentsByCategory('policies');
}

/** All checklist documents. */
export function getAllChecklists(): ExtractedDocument[] {
  return getDocumentsByCategory('checklists');
}

/** All playbook-category documents (AI Chef variants, Blueprint, Third-Party Privacy). */
export function getAllPlaybooks(): ExtractedDocument[] {
  return getDocumentsByCategory('playbooks');
}

/** Lightweight manifest-style summary of every document. */
export function getManifestEntries(): Pick<
  ManifestEntry,
  'documentCode' | 'category' | 'subType' | 'title' | 'sourcePath' | 'format' | 'checksum'
>[] {
  return GOVSECURE_DOCUMENT_LIST.map((d) => ({
    documentCode: d.documentCode,
    category: d.category,
    subType: d.subType,
    title: d.title,
    sourcePath: d.sourcePath,
    format: d.format,
    checksum: d.checksum,
  }));
}

// ─── 4-Tier Risk Model (hard-coded, derived from GovSecure AI Chef toolkit) ─

/**
 * GovSecure's canonical 4-tier risk model. Hard-coded because (a) the values
 * are stable across the product line and (b) downstream consumers (system
 * prompt, agents, document generators) need direct typed access.
 *
 * Source: GovSecure AI Chef™ Toolkit (Section: AI Use Case Intake and Risk
 * Tiering) and the AI Risk Assessment Template Checklist.
 */
export const GOVSECURE_RISK_MODEL: RiskTierModel = {
  version: '1.0',
  tiers: [
    {
      tier: 'Low',
      numericLevel: 1,
      shortDescription:
        'Internal productivity use, low data sensitivity, no external decision impact.',
      examples: [
        'Internal note-taking assistants on non-sensitive data',
        'Boilerplate email drafting for internal use',
        'Code completion tools for non-production code',
      ],
      decisionCriteria: [
        'Data sensitivity is low (public or internal only).',
        'No customer-facing impact and no automated decision-making.',
        'AI output is reviewed by a human before action.',
      ],
      triggers: [],
      requiredGovernance: [
        'Inventory entry in the AI System Registry',
        'Acceptable Use Policy acknowledgment by users',
      ],
      reviewCadence: 'Annual review or on material change',
    },
    {
      tier: 'Moderate',
      numericLevel: 2,
      shortDescription:
        'Business process support with limited customer or employee impact and strong human review.',
      examples: [
        'Customer support draft-reply assistants with mandatory human approval',
        'Document summarization for internal knowledge workers',
        'AI-assisted scheduling or routing tools',
      ],
      decisionCriteria: [
        'Limited customer or employee impact.',
        'Outputs always reviewed by a human before action.',
        'No regulated personal data is processed without controls.',
      ],
      triggers: [],
      requiredGovernance: [
        'Use-Case Intake Form',
        'Initial risk assessment',
        'Vendor due diligence if third-party',
      ],
      reviewCadence: 'Semi-annual review',
    },
    {
      tier: 'High',
      numericLevel: 3,
      shortDescription:
        'Meaningful operational, legal, HR, financial, or customer impact requiring enhanced review.',
      examples: [
        'AI used in hiring screening or HR decisions',
        'AI used in credit, underwriting, or insurance pricing',
        'AI used in clinical decision support',
        'AI making customer-facing automated decisions with appeal rights',
      ],
      decisionCriteria: [
        'Material impact on individuals (employment, finance, health, legal).',
        'Sensitive or regulated data processed (PII, PHI, biometric, financial).',
        'Cross-border data transfer or multi-jurisdictional regulatory exposure.',
      ],
      triggers: [
        'Sensitive/regulated data ingested without strict controls',
        'Automated decisions affecting eligibility, pricing, or claims outcomes',
        'Cross-tenant data exposure not clearly ruled out',
      ],
      requiredGovernance: [
        'Full risk assessment with named approvers',
        'DPIA / privacy review',
        'Security review',
        'Vendor due diligence with evidence pack',
        'Human oversight controls and escalation procedure',
        'Monitoring plan and change management process',
      ],
      reviewCadence: 'Quarterly review and on material change',
    },
    {
      tier: 'Prohibited',
      numericLevel: 4,
      shortDescription:
        'Disallowed use or activity requiring executive decision and a documented exception.',
      examples: [
        'Social scoring of individuals',
        'Real-time biometric surveillance in public spaces (subject to law)',
        'AI used for emotion inference in workplace or education contexts',
        'Manipulative AI techniques targeting vulnerable groups',
      ],
      decisionCriteria: [
        'Use case falls within an Article 5 EU AI Act prohibited practice or equivalent.',
        'Use case is banned by the enterprise Acceptable Use Policy.',
        'Activity poses unacceptable risk to fundamental rights, safety, or democratic process.',
      ],
      triggers: [
        'Any EU AI Act Article 5 practice',
        'Any use case explicitly banned by enterprise policy',
      ],
      requiredGovernance: [
        'Mandatory executive review and documented exception or denial',
        'Legal review',
        'Public-interest justification if the exception is approved',
      ],
      reviewCadence: 'Per-instance executive review',
    },
  ],
  scoringDimensions: [
    {
      name: 'Data Sensitivity',
      description: 'Class of data ingested by the AI system.',
      scale: '1 (public) → 4 (regulated personal/health/financial)',
    },
    {
      name: 'Decision Impact',
      description: 'Impact of the AI output on individuals or operations.',
      scale: '1 (informational) → 4 (autonomous decision affecting rights or finance)',
    },
    {
      name: 'Automation Level',
      description: 'Degree of human review in the loop.',
      scale: '1 (always reviewed) → 4 (fully autonomous action)',
    },
    {
      name: 'External Exposure',
      description: 'Whether the system interacts with customers or the public.',
      scale: '1 (internal only) → 4 (public-facing)',
    },
    {
      name: 'Regulatory Relevance',
      description: 'Applicability of regulated obligations.',
      scale: '1 (none) → 4 (multi-jurisdiction high-risk)',
    },
  ],
};

// ─── AI Chef Operating Model (canonical 6 stations × 4 recipes) ─────────────

/**
 * The 6 GovSecure AI Chef governance stations. Names and identifiers are the
 * canonical structure used across the toolkit; recipe-level detail is
 * available in the extracted toolkit document at
 * `getDocumentBySubType('playbooks', 'ai-chef-toolkit-noncustom')`.
 */
export const AI_CHEF_STATIONS = [
  {
    id: 'S1',
    name: 'Governance Foundation',
    purpose:
      'Establish ownership, decision rights, escalation paths, and oversight cadence for AI in the enterprise.',
  },
  {
    id: 'S2',
    name: 'Risk Assessment Kitchen',
    purpose:
      'Triage every AI use case through intake, risk tiering, DPIA screening, and approval.',
  },
  {
    id: 'S3',
    name: 'Policy Development Station',
    purpose:
      'Build and maintain the policy suite — AUP, governance, data handling, security, oversight.',
  },
  {
    id: 'S4',
    name: 'Vendor Management Prep',
    purpose:
      'Run third-party AI due diligence, contract guardrails, and ongoing vendor monitoring.',
  },
  {
    id: 'S5',
    name: 'Monitoring Station',
    purpose:
      'Operate the AI system registry, change management, monitoring plans, and revalidation.',
  },
  {
    id: 'S6',
    name: 'Incident Response Station',
    purpose:
      'Detect, contain, and remediate AI-specific incidents with documented learning.',
  },
] as const;

// ─── 90-Day Blueprint (canonical 3-phase structure) ─────────────────────────

/**
 * The 3 phases of the GovSecure 90-Day Implementation Blueprint. Detailed
 * week-by-week activities live in the extracted Blueprint document at
 * `getDocumentBySubType('playbooks', '90-day-blueprint-updated')`.
 */
export const GOVSECURE_90_DAY_PHASES = [
  {
    id: 'phase-1',
    name: 'Phase 1 — Foundation',
    durationDays: 30,
    weekRange: 'Weeks 1–4',
    nistFunctionAlignment: ['GOVERN', 'MAP'] as const,
    objectives: [
      'Stand up the AI Governance program with named lead, executive sponsor, and cross-functional working group.',
      'Complete a comprehensive AI Inventory covering all AI tools, models, vendors, and use cases.',
      'Assign a risk tier to every discovered AI use case.',
      'Initiate foundational AI policy drafts (Acceptable Use, Risk, Data Handling).',
      'Establish intake and submission processes for new AI use case requests.',
    ],
  },
  {
    id: 'phase-2',
    name: 'Phase 2 — Implementation',
    durationDays: 30,
    weekRange: 'Weeks 5–8',
    nistFunctionAlignment: ['MAP', 'MEASURE', 'MANAGE'] as const,
    objectives: [
      'Complete risk assessments for all High/Critical AI use cases; triage Moderate cases.',
      'Finalize and gain executive approval for the AI Acceptable Use Policy and AI Risk Management Policy.',
      'Complete vendor due diligence assessments for all active AI-enabled vendors.',
      'Conduct security reviews for all production AI systems.',
      'Complete privacy screening and flag DPIA candidates.',
      'Design human oversight controls and escalation procedures.',
    ],
  },
  {
    id: 'phase-3',
    name: 'Phase 3 — Operationalize',
    durationDays: 30,
    weekRange: 'Weeks 9–13',
    nistFunctionAlignment: ['MEASURE', 'MANAGE'] as const,
    objectives: [
      'Stand up monitoring, change management, and revalidation processes.',
      'Train staff and roll out role-based AI awareness.',
      'Build the evidence pack for the first quarterly governance review.',
      'Establish the steady-state operating cadence (intake, review, monitoring, incident response).',
      'Complete a baseline AI maturity assessment to set Year-2 priorities.',
    ],
  },
] as const;

// ─── Policy Suite Map (15 policies × 3 tiers) ───────────────────────────────

/**
 * GovSecure's full 15-policy suite, organized into three tiers. Hard-coded
 * because the structure is the contract clients buy against; the underlying
 * suite map document at `policies/suite-map.json` is preserved for full prose.
 *
 * Source: GovSecure AI Policy Suite Map (Client Ready) — extracted under
 * `policies/suite-map.json`.
 */
export const GOVSECURE_POLICY_SUITE: PolicySuiteMap = {
  tiers: [
    {
      tier: 'Starter' as PolicySuiteTier,
      description:
        'Core Starter Set — the baseline policies every organization should have before scaling AI.',
      policies: [
        {
          id: 'aup',
          name: 'Enterprise AI Acceptable Use Policy',
          tier: 'Starter',
          scope: 'All employees, contractors, and AI-enabled tools in use.',
          primaryOwner: 'Chief Information Officer / Head of IT',
          audience: ['All staff'],
          companionTemplates: [
            'Approved AI Tools Register',
            'Employee AI Usage Acknowledgment Form',
            'Prohibited Use Exception Request Form',
            'AI Output Human Review Checklist',
            'AI Training Attendance Log',
          ],
          satisfies: { nist: ['GOVERN-1'], iso42001: ['Clause 5'] },
        },
        {
          id: 'governance',
          name: 'AI Governance Policy',
          tier: 'Starter',
          scope: 'Governance structure, ownership, intake, escalation, oversight cadence.',
          primaryOwner: 'Executive Sponsor / AI Governance Lead',
          audience: ['Executives', 'AI Governance Lead', 'Department heads'],
          companionTemplates: [
            'AI Governance Charter',
            'AI Governance RACI Matrix',
            'AI Steering Committee Terms of Reference',
            'AI Escalation Path Matrix',
            'Quarterly AI Governance Review Deck',
          ],
          satisfies: { nist: ['GOVERN-1', 'GOVERN-2'], iso42001: ['Clause 5', 'Clause 7'] },
        },
        {
          id: 'data-privacy',
          name: 'AI Data Handling and Privacy Policy',
          tier: 'Starter',
          scope: 'Data classification, lawful basis, retention, deletion, cross-border transfer for AI.',
          primaryOwner: 'Data Protection Officer / Privacy Lead',
          audience: ['All staff', 'Engineering', 'Procurement'],
          companionTemplates: [
            'AI Data Classification Guide',
            'Sensitive Data Submission Restriction Notice',
            'AI Privacy Impact Assessment Form',
            'AI Data Retention and Deletion Schedule',
            'Cross-Border AI Data Transfer Review Form',
          ],
          satisfies: {
            nist: ['MAP-2'],
            gdpr: ['Article 25', 'Article 35'],
            euAiAct: ['Article 10'],
          },
        },
        {
          id: 'risk-approval',
          name: 'AI Risk Assessment and Use-Case Approval Policy',
          tier: 'Starter',
          scope: 'Mandatory intake, risk tiering, and approval gates for every AI use case.',
          primaryOwner: 'AI Governance Lead',
          audience: ['Business owners', 'Risk team', 'Security'],
          companionTemplates: [
            'AI Use Case Intake Form',
            'AI Risk Assessment Template',
            'AI Use Case Approval Record',
            'Risk Tiering Worksheet',
            'Exception Tracker',
          ],
          satisfies: { nist: ['MAP-1', 'MAP-3', 'MEASURE-1'], iso42001: ['Clause 6', 'Clause 8'] },
        },
        {
          id: 'third-party',
          name: 'Third-Party / Vendor AI Due Diligence Policy',
          tier: 'Starter',
          scope: 'Onboarding, renewal, and incident review for any AI-enabled vendor.',
          primaryOwner: 'Procurement / Vendor Risk Lead',
          audience: ['Procurement', 'Legal', 'Security', 'Privacy'],
          companionTemplates: [
            'GovSecure 3rd-Party AI Vendor Risk Review',
            'Vendor AI Privacy Risk Assessment',
            'TPRM AI Questionnaire',
            'Subprocessor Change Notification',
            'Vendor Evidence Pack Checklist',
          ],
          satisfies: { nist: ['GOVERN-3', 'MAP-4'], iso42001: ['Clause 8'] },
        },
        {
          id: 'incident-response',
          name: 'AI Incident Response Policy',
          tier: 'Starter',
          scope: 'Detection, triage, containment, and post-incident review for AI-specific incidents.',
          primaryOwner: 'CISO / Incident Response Lead',
          audience: ['Security', 'Engineering', 'Communications'],
          companionTemplates: [
            'AI Incident Response Playbook',
            'AI Incident Severity Matrix',
            'AI Post-Incident Review Template',
            'Customer Notification Decision Tree',
            'Evidence Capture Checklist',
          ],
          satisfies: { nist: ['MANAGE-2', 'MANAGE-3'], iso42001: ['Clause 10'] },
        },
      ],
    },
    {
      tier: 'Operational' as PolicySuiteTier,
      description:
        'Operational Control Set — controls that mature an AI program once the starter set is in place.',
      policies: [
        {
          id: 'security',
          name: 'AI Security Policy',
          tier: 'Operational',
          scope: 'Authentication, encryption, access, model integrity, prompt-injection defenses.',
          primaryOwner: 'CISO / Security Architect',
          audience: ['Engineering', 'Security'],
          companionTemplates: [
            'AI Security Review Checklist',
            'Threat Model Template',
            'Pen-Test Scope Document',
            'Model Integrity Validation Plan',
            'Secrets and Key Management Standard',
          ],
          satisfies: { nist: ['MEASURE-2'], iso42001: ['Annex A.7'] },
        },
        {
          id: 'human-oversight',
          name: 'Human Oversight and Decision-Making Policy',
          tier: 'Operational',
          scope: 'Where humans must be in the loop, how oversight is logged and reviewed.',
          primaryOwner: 'AI Governance Lead',
          audience: ['Operations', 'Customer-facing teams'],
          companionTemplates: [
            'Human Oversight Statement Template',
            'Override Decision Log',
            'Escalation Matrix',
            'Reviewer Training Record',
            'Sample Output Audit Sheet',
          ],
          satisfies: { nist: ['MANAGE-1'], euAiAct: ['Article 14'] },
        },
        {
          id: 'monitoring-change',
          name: 'AI Monitoring, Logging, and Change Management Policy',
          tier: 'Operational',
          scope: 'Telemetry, drift detection, change requests, deployment gates.',
          primaryOwner: 'Platform / SRE Lead',
          audience: ['Engineering', 'Operations'],
          companionTemplates: [
            'AI Monitoring Plan Template',
            'Drift Detection Standard',
            'Change Request Form',
            'Deployment Approval Record',
            'Revalidation Schedule',
          ],
          satisfies: { nist: ['MEASURE-3', 'MANAGE-2'] },
        },
        {
          id: 'inventory',
          name: 'AI Inventory and Registry Policy',
          tier: 'Operational',
          scope: 'Single source of truth for all AI systems, models, vendors, and use cases.',
          primaryOwner: 'AI Governance Lead',
          audience: ['Procurement', 'IT', 'Business owners'],
          companionTemplates: [
            'AI System Registry Template',
            'AI Tool Inventory Checklist',
            'Shadow AI Discovery Workflow',
            'Reconciliation Standard',
            'Decommissioning Record',
          ],
          satisfies: { nist: ['MAP-1'] },
        },
      ],
    },
    {
      tier: 'Maturity' as PolicySuiteTier,
      description:
        'Maturity / Assurance Set — adds transparency, lifecycle, ethics, training, and records depth.',
      policies: [
        {
          id: 'transparency',
          name: 'AI Transparency and Disclosure Policy',
          tier: 'Maturity',
          scope: 'Public disclosures, customer notices, model cards, system cards.',
          primaryOwner: 'Compliance / Communications',
          audience: ['Customer-facing teams', 'Legal'],
          companionTemplates: [
            'Model Card Template',
            'System Card Template',
            'Customer Disclosure Notice',
            'Synthetic Content Labeling Standard',
            'Public Release Approval Record',
          ],
          satisfies: { euAiAct: ['Article 13', 'Article 50'] },
        },
        {
          id: 'lifecycle',
          name: 'AI Model Lifecycle / Development Policy',
          tier: 'Maturity',
          scope: 'Training data governance, evaluation gates, model release standards.',
          primaryOwner: 'ML / Engineering Lead',
          audience: ['ML Engineers', 'Data Engineers'],
          companionTemplates: [
            'Data Sheet Template',
            'Model Evaluation Plan',
            'Release Approval Checklist',
            'Training Data Lineage Record',
            'Model Retirement Plan',
          ],
          satisfies: { nist: ['MAP-2', 'MEASURE-1'], iso42001: ['Clause 8'] },
        },
        {
          id: 'ethics',
          name: 'Responsible AI / Ethics Policy',
          tier: 'Maturity',
          scope: 'Fairness, bias, harm reduction, contestability, human dignity.',
          primaryOwner: 'AI Ethics Council Chair',
          audience: ['All AI builders', 'Reviewers'],
          companionTemplates: [
            'Fairness Assessment Template',
            'Bias Mitigation Plan',
            'Contestability Statement',
            'Stakeholder Impact Map',
            'Ethics Council Charter',
          ],
          satisfies: { nist: ['GOVERN-2'], iso42001: ['Clause 4'] },
        },
        {
          id: 'training',
          name: 'AI Training and Awareness Policy',
          tier: 'Maturity',
          scope: 'Role-based training, awareness, continuous learning for AI users and builders.',
          primaryOwner: 'People / L&D Lead',
          audience: ['All staff'],
          companionTemplates: [
            'Role-Based Training Curriculum',
            'AI Training Attendance Log',
            'Awareness Campaign Plan',
            'New-Hire Onboarding Module',
            'Refresher Cadence Standard',
          ],
          satisfies: { nist: ['GOVERN-4'], iso42001: ['Clause 7'] },
        },
        {
          id: 'records',
          name: 'AI Records Retention and Evidence Policy',
          tier: 'Maturity',
          scope: 'What evidence to retain, how long, where, and how to produce on request.',
          primaryOwner: 'Compliance / Records Manager',
          audience: ['Compliance', 'Legal', 'IT'],
          companionTemplates: [
            'Evidence Pack Checklist',
            'Records Retention Schedule',
            'Evidence Storage Standard',
            'Audit Response Workflow',
            'Litigation Hold Procedure',
          ],
          satisfies: { iso42001: ['Clause 7', 'Clause 9'] },
        },
      ],
    },
  ],
};

// ─── NIST RCM (loaded from extracted spreadsheet) ───────────────────────────

/**
 * NIST Risk Control Matrix entries derived from the GovSecure NIST RCM v5
 * spreadsheet (extracted to `frameworks/nist-rcm.json`). Pulls one entry per
 * row of the "Summary" sheet plus per-control rows from the per-category
 * sheets where available.
 */
export const GOVSECURE_NIST_RCM: NISTControl[] = (() => {
  const rcmDoc = getDocumentBySubType('frameworks', 'nist-rcm');
  if (!rcmDoc) return [];

  const summarySheet = rcmDoc.sections.find((s) => s.heading === 'Summary');
  if (!summarySheet || summarySheet.tables.length === 0) return [];

  const rows = summarySheet.tables[0];
  // Skip the header row.
  const controls: NISTControl[] = [];
  for (const row of rows.slice(1)) {
    if (!row[0] || !row[1]) continue;
    controls.push({
      controlId: row[0],
      riskCategoryId: row[0],
      riskCategory: row[1] ?? '',
      riskStatement: row[2] ?? '',
      riskExample: row[4] ?? undefined,
      riskRootCause: row[5] ?? undefined,
      controlObjective: row[6] ?? '',
    });
  }
  return controls;
})();

// ─── Convenience filters ────────────────────────────────────────────────────

/**
 * All Tier-N policies in the suite. Useful when the system prompt or document
 * orchestrator wants to surface "what should I implement first?".
 */
export function getPoliciesByTier(tier: PolicySuiteTier): PolicyEntry[] {
  return GOVSECURE_POLICY_SUITE.tiers.find((t) => t.tier === tier)?.policies ?? [];
}

/** Tier definition for a numeric level (1–4). */
export function getRiskTierByLevel(level: number) {
  return GOVSECURE_RISK_MODEL.tiers.find((t) => t.numericLevel === level);
}

/** Tier definition by name. */
export function getRiskTier(tier: GovSecureRiskTier) {
  return GOVSECURE_RISK_MODEL.tiers.find((t) => t.tier === tier);
}
