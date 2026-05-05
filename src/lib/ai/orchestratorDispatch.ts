/**
 * Dispatches to the appropriate orchestrator based on classified intent.
 *
 * Extracted from the advisor route. Handles intake, document, and playbook
 * generation with artifact persistence.
 */

import { intakeOrchestrator, documentOrchestrator, playbookOrchestrator } from './multiAgent';
import { saveArtifact } from '@/lib/artifacts';
import { classifyIntent, reconcileIntents, type ClassifiedIntent } from './intentClassifier';
import type { AdvisorResponse } from './schemas';
import type { RiskLevel } from './multiAgent';

interface DispatchContext {
  userId: string;
  conversationId?: string;
  role: string;
  query: string;
  riskLevel: RiskLevel;
  apiKey: string;
  /** LLM-detected intent from the advisor response (may differ from deterministic) */
  llmIntent?: AdvisorResponse['intent'];
  /** Whether there is prior conversation context (skips clarification) */
  hasExistingThread?: boolean;
}

export interface DispatchResult {
  artifact?: AdvisorResponse['generatedArtifact'];
  intentUsed: ClassifiedIntent;
  contested: boolean;
  /** If the orchestrator failed, this contains the error details for the UI */
  orchestratorError?: {
    message: string;
    intentType: string;
    retryable: boolean;
  };
}

/** Roles that can trigger document generation orchestrators */
const ALLOWED_ROLES = new Set(['FREE', 'PRO', 'TEAM', 'ENTERPRISE', 'ADMIN']);

function toTierLabel(level: RiskLevel): 'Low' | 'Medium' | 'High' | 'Critical' {
  return (level.charAt(0).toUpperCase() + level.slice(1)) as 'Low' | 'Medium' | 'High' | 'Critical';
}

/**
 * Classify intent and dispatch to the matching orchestrator.
 * Returns the generated artifact (if any) and the intent classification metadata.
 *
 * Non-fatal: returns undefined artifact on orchestrator failure.
 */
export async function dispatchOrchestrator(ctx: DispatchContext): Promise<DispatchResult> {
  // Guest users cannot trigger orchestrators
  if (!ALLOWED_ROLES.has(ctx.role)) {
    const det = classifyIntent(ctx.query, ctx.hasExistingThread);
    return { intentUsed: det, contested: false };
  }

  // Deterministic classification first
  const deterministicIntent = classifyIntent(ctx.query, ctx.hasExistingThread);

  // Reconcile with LLM classification
  const llmIntentTyped = ctx.llmIntent
    ? {
        type: ctx.llmIntent.type as ClassifiedIntent['type'],
        documentType: ctx.llmIntent.documentType,
        framework: ctx.llmIntent.framework,
      }
    : undefined;

  const { finalIntent, contested } = reconcileIntents(deterministicIntent, llmIntentTyped);

  // If intent is just advisory, no orchestrator dispatch needed
  if (finalIntent.type === 'advisor') {
    return { intentUsed: finalIntent, contested };
  }

  // If the query needs clarification (too vague for generation), skip dispatch
  // and let the advisor response with follow-up questions flow through
  if (finalIntent.needsClarification) {
    return { intentUsed: finalIntent, contested: false };
  }

  const useCaseDesc = finalIntent.extractedDescription || ctx.llmIntent?.extractedUseCaseDescription || ctx.query;
  const riskTier = toTierLabel(ctx.riskLevel);

  try {
    let artifact: AdvisorResponse['generatedArtifact'] | undefined;

    if (finalIntent.type === 'intake') {
      const result = await intakeOrchestrator.run(
        { useCaseDescription: useCaseDesc, conversationId: ctx.conversationId },
        ctx.apiKey,
      );
      const artifactId = await saveArtifact({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        type: 'intake',
        title: result.useCaseName,
        riskTier: result.riskTier,
        useCaseName: result.useCaseName,
        content: result,
        markdownExport: result.markdownExport,
      });
      artifact = { type: 'intake', id: artifactId, data: result };

    } else if (finalIntent.type === 'document' && finalIntent.documentType) {
      const docType = finalIntent.documentType as Parameters<typeof documentOrchestrator.run>[0]['documentType'];
      const result = await documentOrchestrator.run(
        { documentType: docType, riskTier, useCaseDescription: useCaseDesc, conversationId: ctx.conversationId },
        ctx.apiKey,
      );
      const artifactId = await saveArtifact({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        type: 'document',
        subType: finalIntent.documentType,
        title: result.title,
        riskTier: result.riskTier,
        useCaseName: result.useCaseName,
        content: result,
        markdownExport: result.markdownExport,
      });
      artifact = { type: 'document', id: artifactId, data: result };

    } else if (finalIntent.type === 'playbook') {
      const framework = (finalIntent.framework || 'Combined') as Parameters<typeof playbookOrchestrator.run>[0]['framework'];
      const result = await playbookOrchestrator.run(
        { framework, riskTier, useCaseDescription: useCaseDesc, conversationId: ctx.conversationId },
        ctx.apiKey,
      );
      const artifactId = await saveArtifact({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        type: 'playbook',
        subType: result.framework,
        title: result.title,
        riskTier: result.riskTier,
        useCaseName: result.useCaseName,
        content: result,
        markdownExport: result.markdownExport,
      });
      artifact = { type: 'playbook', id: artifactId, data: result };
    }

    return { artifact, intentUsed: finalIntent, contested };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[orchestratorDispatch] Failed:', errorMessage);

    // Determine if the error is retryable (rate limits, timeouts, transient network issues)
    const isRetryable = errorMessage.includes('429') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('temporarily unavailable');

    return {
      intentUsed: finalIntent,
      contested,
      orchestratorError: {
        message: `Failed to generate ${finalIntent.type}: ${errorMessage}`,
        intentType: finalIntent.type,
        retryable: isRetryable,
      },
    };
  }
}