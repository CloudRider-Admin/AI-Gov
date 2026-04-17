export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Priority = 'high' | 'medium' | 'low';
export type Relevance = 'high' | 'medium' | 'low';

export type PolicyDocumentType =
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
  | 'evidence-pack';

export interface PolicyRecommendation {
  title: string;
  description: string;
  priority: Priority;
  category: string;
  documentType?: PolicyDocumentType;
}

export interface RegulationMatch {
  regulation: string;
  article: string;
  relevance: Relevance;
  description: string;
}

export interface AdvisorResponse {
  mode?: 'assessment' | 'clarification';
  riskProfile: {
    level: RiskLevel;
    description: string;
    confidence: number;
    reasoning: string[];
  };
  suggestedPolicies: PolicyRecommendation[];
  regulationCheck: RegulationMatch[];
  followUpQuestions: string[];
  sources: string[];
  conversationId: string;
  timestamp: string;
  gated?: boolean;
  intent?: {
    type: 'advisor' | 'intake' | 'document' | 'playbook';
    documentType?: string;
    framework?: string;
    extractedUseCaseDescription?: string;
  };
  generatedArtifact?: {
    type: string;
    id: string;
    data?: unknown;
  };
  orchestratorError?: {
    message: string;
    intentType: string;
    retryable: boolean;
  };
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export const riskLevelCopy: Record<RiskLevel, { label: string; color: string; badge: string }> = {
  low: {
    label: 'Low Risk',
    color: 'text-terminal-green',
    badge: 'bg-terminal-green/10 text-terminal-green',
  },
  medium: {
    label: 'Medium Risk',
    color: 'text-terminal-amber',
    badge: 'bg-yellow-500/10 text-terminal-amber',
  },
  high: {
    label: 'High Risk',
    color: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400',
  },
  critical: {
    label: 'Critical Risk',
    color: 'text-red-500',
    badge: 'bg-red-600/15 text-red-500',
  },
};

export const priorityCopy: Record<Priority, { label: string; badge: string }> = {
  high: { label: 'High Priority', badge: 'bg-red-500/10 text-red-400' },
  medium: { label: 'Medium Priority', badge: 'bg-terminal-amber/10 text-terminal-amber' },
  low: { label: 'Low Priority', badge: 'bg-terminal-green/10 text-terminal-green' },
};

export const relevanceCopy: Record<Relevance, { label: string; badge: string }> = {
  high: { label: 'High Relevance', badge: 'bg-terminal-green/10 text-terminal-green' },
  medium: { label: 'Medium Relevance', badge: 'bg-terminal-amber/10 text-terminal-amber' },
  low: { label: 'Low Relevance', badge: 'bg-terminal-muted/20 text-terminal-muted' },
};
