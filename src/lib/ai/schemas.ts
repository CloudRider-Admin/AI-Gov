import { z } from 'zod';

export const advisorRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  context: z.string().optional(),
  conversationId: z.string().optional()
});

export const policyRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  category: z.string(),
  documentType: z.enum([
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
  ]).optional(),
});

export const regulationMatchSchema = z.object({
  regulation: z.string(),
  article: z.string(),
  relevance: z.enum(['high', 'medium', 'low']),
  description: z.string()
});

export const advisorResponseSchema = z.object({
  mode: z.enum(['assessment', 'clarification']).default('assessment'),
  riskProfile: z.object({
    level: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.array(z.string()).default([])
  }),
  suggestedPolicies: z.array(policyRecommendationSchema).default([]),
  regulationCheck: z.array(regulationMatchSchema).default([]),
  followUpQuestions: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  conversationId: z.string(),
  timestamp: z.string(),
  gated: z.boolean().optional(),
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
  modelType: z.enum(['GenAI', 'Predictive ML', 'Rules + ML', 'Vendor Feature']).optional(),
  deployment: z.enum(['Internal', 'Customer-facing', 'Public-facing']).optional(),
  jurisdictions: z.array(z.string()).optional(),
  goLiveTarget: z.string().optional(),
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
  tier: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['generated', 'pending', 'not-required']).default('pending'),
});

export const intakeAssessmentSchema = z.object({
  useCaseName: z.string(),
  owner: z.string().default(''),
  businessUnit: z.string().default(''),
  modelType: z.enum(['GenAI', 'Predictive ML', 'Rules + ML', 'Vendor Feature']).default('GenAI'),
  deployment: z.enum(['Internal', 'Customer-facing', 'Public-facing']).default('Internal'),
  jurisdictions: z.array(z.string()).default([]),
  goLiveTarget: z.string().nullable().optional(),
  assessmentDate: z.string(),
  riskDrivers: z.array(riskDriverSchema),
  totalScore: z.number().min(0).max(30),
  autoHighTriggers: z.array(autoHighTriggerSchema),
  autoHighFired: z.boolean(),
  riskTier: z.enum(['Low', 'Medium', 'High', 'Critical']),
  tierRationale: z.string(),
  requiredApprovers: z.array(z.enum(['Compliance', 'Security', 'Legal/Privacy', 'Risk/ERM'])).default([]),
  requiredArtifacts: z.array(requiredArtifactSchema).default([]),
  launchDecision: z.enum(['Go', 'Conditional Go', 'No-Go']),
  conditions: z.string().optional(),
  nextReviewDate: z.string(),
  reassessmentTriggers: z.array(z.string()).default([]),
  euAIActClassification: z.enum(['Prohibited', 'High-Risk', 'Limited-Risk', 'Minimal-Risk', 'General-Purpose']),
  euAIActRationale: z.string(),
  nistKeySubcategories: z.array(z.string()).default([]),
  markdownExport: z.string().default(''),
});

export type IntakeRequest = z.infer<typeof intakeRequestSchema>;
export type IntakeAssessmentOutput = z.infer<typeof intakeAssessmentSchema>;

// ─── Governance Document Schemas ──────────────────────────────────────────────

export const documentRequestSchema = z.object({
  documentType: z.enum([
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
  ]),
  riskTier: z.enum(['Low', 'Medium', 'High', 'Critical']),
  useCaseDescription: z.string().min(10),
  useCaseName: z.string().optional(),
  context: z.string().optional(),
  conversationId: z.string().optional(),
});

const frameworkCitationSchema = z.object({
  framework: z.enum(['NIST AI RMF', 'EU AI Act', 'ISO/IEC 42001', 'GDPR', 'Other']),
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
  content: z.string(),
  checklistItems: z.array(checklistItemSchema).optional(),
  required: z.boolean().default(true),
});

export const governanceDocumentSchema = z.object({
  documentType: z.enum([
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
  ]),
  title: z.string(),
  riskTier: z.enum(['Low', 'Medium', 'High', 'Critical']),
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
  framework: z.enum(['NIST AI RMF', 'EU AI Act', 'ISO/IEC 42001', 'Combined']),
  riskTier: z.enum(['Low', 'Medium', 'High', 'Critical']),
  useCaseDescription: z.string().min(10),
  useCaseName: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  conversationId: z.string().optional(),
});

const playbookTaskSchema = z.object({
  taskId: z.string(),
  name: z.string(),
  description: z.string(),
  owner: z.enum([
    'AI Governance Lead',
    'Business Owner',
    'Security Team',
    'Privacy/Legal',
    'IT/Engineering',
    'HR/Training',
    'Risk/Compliance',
    'Executive Sponsor',
  ]),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
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
  framework: z.enum(['NIST AI RMF', 'EU AI Act', 'ISO/IEC 42001', 'Combined']),
  riskTier: z.enum(['Low', 'Medium', 'High', 'Critical']),
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
