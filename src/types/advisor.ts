import type { DocumentType } from './documents';
import type { SourceProvenance } from '@/lib/ai/rag';

export type { SourceProvenance };

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Priority = 'high' | 'medium' | 'low';
export type Relevance = 'high' | 'medium' | 'low';

/**
 * Re-export of `DocumentType` under the advisor-domain alias. The advisor
 * surface used to maintain a parallel union; Phase 5 collapsed both onto
 * the single source of truth in `@/types/documents`. The runtime equivalent
 * is `DOCUMENT_TYPE_VALUES` in `@/lib/ai/schemas`, and the sync guard test
 * (`schemas.test.ts`) catches any drift.
 */
export type PolicyDocumentType = DocumentType;

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
  /**
   * Structured provenance for `sources`. Each entry's `label` matches the
   * corresponding string in `sources[]`; consumers should prefer this for
   * grouping/filtering rather than parsing the human label.
   */
  sourcesStructured?: SourceProvenance[];
  /**
   * Soft post-processing warnings — citation validator flags, framework
   * sync notes, etc. Populated by `/api/advisor/route.ts` after the multi-
   * agent response is validated. Renders as a banner above the answer.
   */
  warnings?: string[];
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
    badge: 'bg-terminal-amber/10 text-terminal-amber',
  },
  high: {
    label: 'High Risk',
    color: 'text-terminal-red',
    badge: 'bg-terminal-red/10 text-terminal-red',
  },
  critical: {
    label: 'Critical Risk',
    color: 'text-terminal-red',
    badge: 'bg-terminal-red/20 text-terminal-red',
  },
};

export const priorityCopy: Record<Priority, { label: string; badge: string }> = {
  high: { label: 'High Priority', badge: 'bg-terminal-red/10 text-terminal-red' },
  medium: { label: 'Medium Priority', badge: 'bg-terminal-amber/10 text-terminal-amber' },
  low: { label: 'Low Priority', badge: 'bg-terminal-green/10 text-terminal-green' },
};

export const relevanceCopy: Record<Relevance, { label: string; badge: string }> = {
  high: { label: 'High Relevance', badge: 'bg-terminal-green/10 text-terminal-green' },
  medium: { label: 'Medium Relevance', badge: 'bg-terminal-amber/10 text-terminal-amber' },
  low: { label: 'Low Relevance', badge: 'bg-terminal-muted/20 text-terminal-muted' },
};
