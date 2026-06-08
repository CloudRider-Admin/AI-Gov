import { z } from 'zod';

/**
 * Single source of truth for every `documentType` enum used by the
 * advisor / orchestrator schemas. Matches `DocumentType` in
 * `@/types/documents` — extending one without the other will fail
 * type-checking inside `documentTemplates.ts`.
 *
 * Phase 2 added 22 GovSecure types on top of the original 11.
 */
export const DOCUMENT_TYPE_VALUES = [
  // generic governance documents
  'use-case-summary',
  'data-sheet',
  'vendor-model-facts',
  'threat-model',
  'human-oversight-statement',
  'dpia',
  'model-card',
  'risk-memo',
  'operational-readiness-plan',
  'monitoring-plan',
  'evidence-pack',
  // GovSecure policies
  'govsecure-aup',
  'govsecure-governance-policy',
  'govsecure-data-privacy-policy',
  'govsecure-risk-approval-policy',
  'govsecure-security-policy',
  'govsecure-incident-response-policy',
  'govsecure-human-oversight-policy',
  'govsecure-vendor-policy',
  'govsecure-third-party-policy',
  // GovSecure checklists
  'govsecure-checklist-intake',
  'govsecure-checklist-evidence-pack',
  'govsecure-checklist-incident-response',
  'govsecure-checklist-vendor-dd',
  'govsecure-checklist-shadow-ai',
  'govsecure-checklist-inventory',
  'govsecure-checklist-model-validation',
  'govsecure-checklist-monitoring',
  'govsecure-checklist-security',
  'govsecure-checklist-dpia',
  'govsecure-checklist-human-oversight',
  'govsecure-checklist-change-management',
  'govsecure-checklist-training',
  'govsecure-checklist-risk-assessment',
  // GovSecure flagship questionnaires + framework templates (Phase 3)
  'govsecure-tprm',
  'govsecure-nist-rcm',
] as const;

export const documentTypeEnum = z.enum(DOCUMENT_TYPE_VALUES);

/**
 * Single source of truth for the playbook framework union — covers the four
 * regulatory frameworks plus the two GovSecure flagship products added in
 * Phase 3.
 */
export const PLAYBOOK_FRAMEWORK_VALUES = [
  'NIST AI RMF',
  'EU AI Act',
  'ISO/IEC 42001',
  'Combined',
  'GovSecure AI Chef',
  'GovSecure 90-Day Blueprint',
] as const;

export const playbookFrameworkEnum = z.enum(PLAYBOOK_FRAMEWORK_VALUES);

/**
 * Shared enum values. Each `*_VALUES` constant is the single source of truth
 * for both the Zod schema and the TS union in `@/types/documents` /
 * `@/types/advisor`. The Phase 5 sync guard test
 * (`__tests__/schemas.test.ts`) asserts the runtime `*_VALUES.length`
 * matches the union arity so drift fails CI.
 */
export const RISK_TIER_VALUES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const RISK_LEVEL_VALUES = ['low', 'medium', 'high', 'critical'] as const;
export const MODEL_TYPE_VALUES = ['GenAI', 'Predictive ML', 'Rules + ML', 'Vendor Feature'] as const;
export const DEPLOYMENT_TYPE_VALUES = ['Internal', 'Customer-facing', 'Public-facing'] as const;
export const EU_AI_ACT_CLASSIFICATION_VALUES = [
  'Prohibited',
  'High-Risk',
  'Limited-Risk',
  'Minimal-Risk',
  'General-Purpose',
] as const;
export const REQUIRED_APPROVER_VALUES = ['Compliance', 'Security', 'Legal/Privacy', 'Risk/ERM'] as const;
export const LAUNCH_DECISION_VALUES = ['Go', 'Conditional Go', 'No-Go'] as const;
export const TASK_OWNER_VALUES = [
  'AI Governance Lead',
  'Business Owner',
  'Security Team',
  'Privacy/Legal',
  'IT/Engineering',
  'HR/Training',
  'Risk/Compliance',
  'Executive Sponsor',
] as const;
export const TASK_PRIORITY_VALUES = ['critical', 'high', 'medium', 'low'] as const;
export const PRIORITY_VALUES = ['high', 'medium', 'low'] as const;
export const FRAMEWORK_CITATION_VALUES = ['NIST AI RMF', 'EU AI Act', 'ISO/IEC 42001', 'GDPR', 'Other'] as const;
export const ARTIFACT_STATUS_VALUES = ['generated', 'pending', 'not-required'] as const;

export const riskTierEnum = z.enum(RISK_TIER_VALUES);
export const riskLevelEnum = z.enum(RISK_LEVEL_VALUES);
export const modelTypeEnum = z.enum(MODEL_TYPE_VALUES);
export const deploymentTypeEnum = z.enum(DEPLOYMENT_TYPE_VALUES);
export const euAIActClassificationEnum = z.enum(EU_AI_ACT_CLASSIFICATION_VALUES);
export const requiredApproverEnum = z.enum(REQUIRED_APPROVER_VALUES);
export const launchDecisionEnum = z.enum(LAUNCH_DECISION_VALUES);
export const taskOwnerEnum = z.enum(TASK_OWNER_VALUES);
export const taskPriorityEnum = z.enum(TASK_PRIORITY_VALUES);
export const priorityEnum = z.enum(PRIORITY_VALUES);
export const frameworkCitationEnum = z.enum(FRAMEWORK_CITATION_VALUES);
export const artifactStatusEnum = z.enum(ARTIFACT_STATUS_VALUES);

export const advisorRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  context: z.string().optional(),
  conversationId: z.string().optional()
});

export const policyRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: priorityEnum,
  category: z.string(),
  documentType: documentTypeEnum.optional(),
});

export const regulationMatchSchema = z.object({
  regulation: z.string(),
  article: z.string(),
  relevance: priorityEnum,
  description: z.string()
});

export const advisorResponseSchema = z.object({
  mode: z.enum(['assessment', 'clarification']).default('assessment'),
  riskProfile: z.object({
    level: riskLevelEnum,
    description: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.array(z.string()).default([])
  }),
  suggestedPolicies: z.array(policyRecommendationSchema).default([]),
  regulationCheck: z.array(regulationMatchSchema).default([]),
  followUpQuestions: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  /**
   * Structured provenance — typed counterpart to `sources`. Optional because
   * legacy stored conversations only carry the flat list. New responses
   * always populate it.
   */
  sourcesStructured: z
    .array(
      z.object({
        label: z.string(),
        type: z.enum([
          'govsecure',
          'nist',
          'static-kb',
          'vector-kb',
          'db-kb',
          'sector-guidance',
          'regulation',
        ]),
        anchor: z.string().optional(),
      }),
    )
    .optional(),
  conversationId: z.string(),
  timestamp: z.string(),
  gated: z.boolean().optional(),
  /**
   * Soft warnings surfaced by post-processing (e.g. citation validator
   * stripping unverified regulatory references). UI can render these as
   * a banner. Optional and non-fatal.
   */
  warnings: z.array(z.string()).optional(),
  intent: z.object({
    type: z.enum(['advisor', 'intake', 'document', 'playbook']).default('advisor'),
    documentType: z.string().optional(),
    framework: z.string().optional(),
    extractedUseCaseDescription: z.string().optional(),
  }).optional(),
  generatedArtifact: z.object({
    type: z.string(),
    id: z.string(),
    data: z.unknown().optional(),
  }).optional(),
  orchestratorError: z.object({
    message: z.string(),
    intentType: z.string(),
    retryable: z.boolean(),
  }).optional(),
});

export type AdvisorRequest = z.infer<typeof advisorRequestSchema>;
export type PolicyRecommendation = z.infer<typeof policyRecommendationSchema>;
export type RegulationMatch = z.infer<typeof regulationMatchSchema>;
export type AdvisorResponse = z.infer<typeof advisorResponseSchema>;

// ─── Intake Risk Assessment Schemas ──────────────────────────────────────────

export const intakeRequestSchema = z.object({
  useCaseDescription: z.string().min(10, 'Use case description is required'),
  useCaseName: z.string().optional(),
  owner: z.string().optional(),
  businessUnit: z.string().optional(),
  modelType: modelTypeEnum.optional(),
  deployment: deploymentTypeEnum.optional(),
  jurisdictions: z.array(z.string()).optional(),
  goLiveTarget: z.string().optional(),
  /** Occupational role of the requesting user (e.g. "Security / CISO"), used to
   *  surface the requestor lens on the assessment. Captured at onboarding. */
  occupationalRole: z.string().optional(),
  conversationId: z.string().optional(),
});

const riskDriverSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  notes: z.string(),
  nistMappings: z.array(z.string()).default([]),
  euAiActMappings: z.array(z.string()).default([]),
});

const autoHighTriggerSchema = z.object({
  id: z.string(),
  description: z.string(),
  fired: z.boolean(),
  reason: z.string(),
});

const requiredArtifactSchema = z.object({
  name: z.string(),
  description: z.string(),
  tier: riskTierEnum,
  status: artifactStatusEnum.default('pending'),
});

export const intakeAssessmentSchema = z.object({
  useCaseName: z.string(),
  owner: z.string().default(''),
  businessUnit: z.string().default(''),
  /** Occupational role of the requesting user, echoed into the header block. */
  requestorRole: z.string().optional(),
  modelType: modelTypeEnum.default('GenAI'),
  deployment: deploymentTypeEnum.default('Internal'),
  jurisdictions: z.array(z.string()).default([]),
  goLiveTarget: z.string().nullable().optional(),
  assessmentDate: z.string(),
  riskDrivers: z.array(riskDriverSchema),
  totalScore: z.number().min(0).max(30),
  autoHighTriggers: z.array(autoHighTriggerSchema),
  autoHighFired: z.boolean(),
  riskTier: riskTierEnum,
  tierRationale: z.string(),
  requiredApprovers: z.array(requiredApproverEnum).default([]),
  requiredArtifacts: z.array(requiredArtifactSchema).default([]),
  launchDecision: launchDecisionEnum,
  conditions: z.string().optional(),
  nextReviewDate: z.string(),
  reassessmentTriggers: z.array(z.string()).default([]),
  euAIActClassification: euAIActClassificationEnum,
  euAIActRationale: z.string(),
  nistKeySubcategories: z.array(z.string()).default([]),
  markdownExport: z.string().default(''),
});

export type IntakeRequest = z.infer<typeof intakeRequestSchema>;
export type IntakeAssessmentOutput = z.infer<typeof intakeAssessmentSchema>;

// ─── Governance Document Schemas ──────────────────────────────────────────────

export const documentRequestSchema = z.object({
  documentType: documentTypeEnum,
  riskTier: riskTierEnum,
  useCaseDescription: z.string().min(10),
  useCaseName: z.string().optional(),
  context: z.string().optional(),
  conversationId: z.string().optional(),
});

const frameworkCitationSchema = z.object({
  framework: frameworkCitationEnum,
  reference: z.string(),
  description: z.string(),
});

const checklistItemSchema = z.object({
  text: z.string(),
  complete: z.boolean().default(false),
  notes: z.string().optional(),
});

const documentSectionSchema = z.object({
  heading: z.string(),
  // GPT-4o emits `null` for `content` on checklist-only sections and for
  // `checklistItems` on prose-only sections. Coerce both nullish forms to
  // their empty equivalents so a structurally valid document isn't discarded
  // on a type technicality (was the dominant DocumentOrchestrator error).
  content: z.string().nullish().transform((v) => v ?? ''),
  checklistItems: z.array(checklistItemSchema).nullish().transform((v) => v ?? undefined),
  required: z.boolean().default(true),
});

export const governanceDocumentSchema = z.object({
  documentType: documentTypeEnum,
  title: z.string(),
  riskTier: riskTierEnum,
  useCaseName: z.string(),
  sections: z.array(documentSectionSchema),
  frameworkCitations: z.array(frameworkCitationSchema).default([]),
  reviewCycle: z.string(),
  generatedAt: z.string(),
  markdownExport: z.string().default(''),
});

export type DocumentRequest = z.infer<typeof documentRequestSchema>;
export type GovernanceDocumentOutput = z.infer<typeof governanceDocumentSchema>;

// ─── Playbook Schemas ─────────────────────────────────────────────────────────

export const playbookRequestSchema = z.object({
  framework: playbookFrameworkEnum,
  riskTier: riskTierEnum,
  useCaseDescription: z.string().min(10),
  useCaseName: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  conversationId: z.string().optional(),
});

const playbookTaskSchema = z.object({
  taskId: z.string(),
  name: z.string(),
  description: z.string(),
  owner: taskOwnerEnum,
  priority: taskPriorityEnum,
  effort: z.string(),
  dependsOn: z.array(z.string()).optional(),
  nistActions: z.array(z.string()).default([]),
  output: z.string(),
});

const playbookPhaseSchema = z.object({
  phaseNumber: z.number(),
  phaseName: z.string(),
  duration: z.string(),
  objectives: z.array(z.string()),
  tasks: z.array(playbookTaskSchema),
  nistActionsSource: z.array(z.string()).default([]),
  deliverables: z.array(z.string()),
  documentationRequirements: z.array(z.string()).default([]),
});

const playbookKPISchema = z.object({
  metric: z.string(),
  target: z.string(),
  measurementMethod: z.string(),
  frequency: z.string(),
});

export const playbookSchema = z.object({
  title: z.string(),
  framework: playbookFrameworkEnum,
  riskTier: riskTierEnum,
  useCaseName: z.string(),
  summary: z.string(),
  phases: z.array(playbookPhaseSchema),
  kpis: z.array(playbookKPISchema),
  totalDuration: z.string(),
  frameworkVersions: z.array(z.string()).default([]),
  generatedAt: z.string(),
  markdownExport: z.string().default(''),
});

export type PlaybookRequest = z.infer<typeof playbookRequestSchema>;
export type PlaybookOutput = z.infer<typeof playbookSchema>;

export function buildFallbackResponse(message: string, conversationId?: string): AdvisorResponse {
  const now = new Date().toISOString();
  return {
    mode: 'assessment',
    riskProfile: {
      level: 'medium',
      description: message,
      confidence: 0.5,
      reasoning: [message]
    },
    suggestedPolicies: [
      {
        title: 'AI Acceptable Use Policy',
        description: 'Establish clear guidelines for AI system usage within your organization',
        priority: 'high',
        category: 'governance',
        documentType: 'use-case-summary',
      },
      {
        title: 'Data Privacy Assessment',
        description: 'Conduct privacy impact assessment for AI data processing',
        priority: 'medium',
        category: 'compliance',
        documentType: 'dpia',
      }
    ],
    regulationCheck: [
      {
        regulation: 'GDPR',
        article: 'Article 22',
        relevance: 'high',
        description: 'Automated decision-making provisions may apply to your AI system'
      }
    ],
    followUpQuestions: [
      'What type of data does your AI system process?',
      'Do you have human oversight mechanisms in place?',
      'Have you conducted a risk assessment?'
    ],
    sources: ['Demo Response - Configure OpenAI for real analysis'],
    conversationId: conversationId || `demo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: now
  };
}
