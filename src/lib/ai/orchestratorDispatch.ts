/**
 * Dispatches to the appropriate orchestrator based on classified intent.
 *
 * Extracted from the advisor route. Handles intake, document, and playbook
 * generation with artifact persistence.
 */

import { intakeOrchestrator, documentOrchestrator, playbookOrchestrator } from './multiAgent';
import { saveArtifact } from '@/lib/artifacts';
import { classifyIntent, reconcileIntents, type ClassifiedIntent } from './intentClassifier';
import { captureOrgContext, getOrgContext } from './orgContext';
import {
  captureIntakeProfile,
  getIntakeProfile,
  assessIntakeProfileCompleteness,
  intakeProfileToOrchestratorInput,
  type IntakeProfile,
} from './intakeProfile';
import { artifactCache, buildArtifactKey, hashOrgContext } from '@/lib/responseCache';
import { auditLog } from '@/lib/utils/logger';
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
  /**
   * For intake intents only: the orchestrator was deferred because the
   * GovSecure Use-Case Intake Form is incomplete. Contains the questions
   * the advisor should ask before scoring. The advisor route surfaces
   * these as `followUpQuestions`.
   */
  intakeNeedsMoreInfo?: {
    missingFields: string[];
    questions: string[];
    completeness: number;
    capturedProfile: IntakeProfile;
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

  // Phase 4.5: extract org context from the user's turn before any
  // orchestrator runs so newly-stated org details (industry, AI tools,
  // jurisdictions, lead title) flow into this same generation.
  // Best-effort: if the conversation row doesn't exist yet (guest path)
  // captureOrgContext is a no-op via its prisma try/catch.
  if (ctx.conversationId) {
    await captureOrgContext(ctx.conversationId, ctx.query);
    // Capture GovSecure intake-form fields from the user's turn so the
    // intake orchestrator can score against real input rather than
    // inventing "humans retain control" / "Vendor DPA in place".
    await captureIntakeProfile(ctx.conversationId, ctx.query);
  }

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

  // ── Artifact cache lookup (Phase 7.3) ──
  // Skip cache when there's no conversationId (guest path can't read orgContext)
  // since we'd be omitting a key signal that the intent is the same.
  const orgCtx = ctx.conversationId ? await getOrgContext(ctx.conversationId).catch(() => undefined) : undefined;
  const cacheKey = buildArtifactKey({
    intentType: finalIntent.type,
    documentType: finalIntent.documentType,
    framework: finalIntent.framework,
    useCaseDescription: useCaseDesc,
    orgContextHash: hashOrgContext(orgCtx),
    role: ctx.role,
  });
  const cachedArtifact = artifactCache.get(cacheKey) as AdvisorResponse['generatedArtifact'] | undefined;
  if (cachedArtifact) {
    auditLog({ event: 'artifact.cache_hit', data: { cacheKey, intentType: finalIntent.type } });
    return { artifact: cachedArtifact, intentUsed: finalIntent, contested };
  }

  try {
    let artifact: AdvisorResponse['generatedArtifact'] | undefined;

    if (finalIntent.type === 'intake') {
      // Gate scoring on intake-form completeness. If the GovSecure Section
      // A / C / D minimum isn't captured, ask for it BEFORE running the
      // orchestrator — never default to "Internal" / "Not specified" and
      // let the LLM invent driver-note context to fill the gap.
      const profile = ctx.conversationId
        ? await getIntakeProfile(ctx.conversationId)
        : ({} as IntakeProfile);
      const completeness = assessIntakeProfileCompleteness(profile);
      if (!completeness.ok) {
        auditLog({
          event: 'intake.deferred_incomplete_profile',
          data: {
            conversationId: ctx.conversationId,
            missing: completeness.missing,
            completeness: completeness.completeness,
          },
        });
        return {
          intentUsed: finalIntent,
          contested,
          intakeNeedsMoreInfo: {
            missingFields: completeness.missing,
            questions: completeness.questions,
            completeness: completeness.completeness,
            capturedProfile: profile,
          },
        };
      }

      // Profile is complete — thread the captured fields into the
      // orchestrator so the prompt scores against real input.
      const orgCtxFull = ctx.conversationId
        ? await getOrgContext(ctx.conversationId)
        : undefined;
      const orchestratorInput = intakeProfileToOrchestratorInput(
        profile,
        orgCtxFull?.jurisdictions,
      );
      const result = await intakeOrchestrator.run(
        {
          useCaseDescription: useCaseDesc,
          conversationId: ctx.conversationId,
          ...orchestratorInput,
        },
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

    // ── Cache the freshly generated artifact (Phase 7.3) ──
    if (artifact) {
      artifactCache.set(cacheKey, artifact);
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