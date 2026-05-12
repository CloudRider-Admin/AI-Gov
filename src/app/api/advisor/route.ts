import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { advisorRequestSchema, buildFallbackResponse } from '@/lib/ai/schemas';
import { auditLog } from '@/lib/utils/logger';
import { buildEnhancedRAGContext } from '@/lib/ai/rag';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { parseAdvisorResponse, buildValidatedResponse, applyGating } from '@/lib/ai/responseParser';
import { dispatchOrchestrator } from '@/lib/ai/orchestratorDispatch';
import { classifyIntent } from '@/lib/ai/intentClassifier';
import { getOrgContext, extractFromText as extractOrgContextFromText, type OrgContext } from '@/lib/ai/orgContext';
import {
  getIntakeProfile,
  extractIntakeProfileFromText,
  mergeIntakeProfile,
  type IntakeProfile,
} from '@/lib/ai/intakeProfile';
import { recommendPolicies, toPolicyRecommendation } from '@/data/govsecurePolicySuite';
import { rankRegulationsForContext } from '@/data/emergingRegulations';
import { pickAdvisorModel } from '@/lib/ai/modelRouter';
import { ensureConversation, persistMessages } from '@/lib/conversation';
import { checkTokenBudget, recordTokenUsage } from '@/lib/tokenBudget';
import { advisorCache, ResponseCache } from '@/lib/responseCache';
import { openaiCircuit, CircuitOpenError } from '@/lib/circuitBreaker';
import { buildRateLimitHeaders } from '@/lib/rateLimitHeaders';
import { guardInput, PromptInjectionError } from '@/lib/security/promptGuard';
import { trackEvent } from '@/lib/analytics';
import { GOVERNANCE_SYSTEM_PROMPT } from '@/lib/ai/systemPrompt';
import { claudeComplete, isOpenAIQuotaError, isClaudeFallbackAvailable } from '@/lib/ai/claudeFallback';
import {
  flattenStrings,
  STRIP_THRESHOLD,
  unverifiedCitations,
  validateCitations,
} from '@/lib/ai/citationValidator';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  const isGuest = !session;
  const rateLimitId = isGuest ? `guest:${getClientIp(request)}` : session.user.id;
  const role = isGuest ? 'GUEST' : (session.user.role ?? 'FREE');

  const rateCheck = await checkRateLimit(rateLimitId, '/api/advisor', role);
  const rateLimitHeaders = buildRateLimitHeaders(rateCheck);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  // ── Token budget check (non-guest only) ──
  if (!isGuest) {
    const budget = await checkTokenBudget(session.user.id, role);
    if (!budget.allowed) {
      auditLog({ event: 'token.budget_exceeded', data: { userId: session.user.id, used: budget.used, limit: budget.limit } });
      return NextResponse.json(
        { error: 'Monthly token budget exceeded. Upgrade your plan for more capacity.', used: budget.used, limit: budget.limit },
        { status: 429 },
      );
    }
  }

  const startTime = Date.now();
  let conversationId: string | undefined;

  try {
    const body = await request.json();
    const parseResult = advisorRequestSchema.safeParse(body);
    if (!parseResult.success) {
      auditLog({ event: 'request.failed', data: { reason: 'validation_error', errors: parseResult.error.flatten() } });
      return NextResponse.json({ error: 'Invalid request', details: parseResult.error.flatten() }, { status: 400 });
    }

    const { context } = parseResult.data;
    conversationId = parseResult.data.conversationId;

    // ── Prompt injection guard ──
    const query = guardInput(parseResult.data.query, {
      userId: isGuest ? undefined : session.user.id,
      endpoint: '/api/advisor',
    });

    auditLog({ event: 'request.received', data: { queryLength: query.length, hasContext: !!context, conversationId, isGuest } });
    trackEvent({ userId: isGuest ? undefined : session.user.id, event: 'query', category: 'advisor', metadata: { queryLength: query.length } });

    // ── Fallback if no API key ──
    if (!process.env.OPENAI_API_KEY) {
      const fb = buildFallbackResponse('This is a demo response. Configure your OpenAI API key for real analysis.', conversationId);
      auditLog({ event: 'response.fallback', data: { reason: 'missing_api_key', conversationId: fb.conversationId } });
      return NextResponse.json(fb);
    }

    // ── Cache check (scoped to conversation + role to prevent cross-contamination) ──
    const cacheKey = ResponseCache.buildKey(query, context, conversationId, role);
    const cached = advisorCache.get(cacheKey);
    if (cached) {
      auditLog({ event: 'cache.hit', data: { cacheKey, queryLength: query.length } });
      return NextResponse.json(cached);
    }

    // ── RAG context retrieval ──
    const ragResult = await buildEnhancedRAGContext(query, { totalBudget: 7 });
    let contextualQuery = query;
    const hasConversationHistory = !!context;
    if (context) contextualQuery = `${context}\n\nNew message from the user: ${query}`;
    if (ragResult.context) contextualQuery = `${ragResult.context}\n\n${contextualQuery}`;

    // ── Tiered model selection (Phase 7.2) ──
    const deterministicIntent = classifyIntent(query, hasConversationHistory);
    const modelChoice = pickAdvisorModel({
      query,
      hasExistingThread: hasConversationHistory,
      classifiedIntent: deterministicIntent,
    });
    const model = modelChoice.model;

    // ── Build the user message once (reused across providers) ──
    const userMessage = hasConversationHistory
      ? `${contextualQuery}\n\nThe user is continuing an existing conversation with established context. Provide a full assessment (mode: "assessment") incorporating all context. Respond with a JSON object containing: mode, riskProfile, suggestedPolicies, regulationCheck, followUpQuestions, sources, and intent.`
      : `${contextualQuery}\n\nFirst determine if this query provides enough context for a full assessment or if you need to ask clarifying questions. Then respond with a JSON object containing: mode, riskProfile, suggestedPolicies, regulationCheck, followUpQuestions, sources, and intent.`;

    // ── OpenAI call (with circuit breaker), Claude fallback on quota/circuit-open ──
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let aiResponse: string | null = null;
    let usedProvider: 'openai' | 'claude' = 'openai';
    let usedModel = model;
    let promptTokens = 0;
    let completionTokens = 0;
    let cachedTokens = 0;

    try {
      const completion = await openaiCircuit.execute(() =>
        openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: GOVERNANCE_SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
      );
      cachedTokens = (completion.usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)
        ?.prompt_tokens_details?.cached_tokens ?? 0;
      promptTokens = completion.usage?.prompt_tokens ?? 0;
      completionTokens = completion.usage?.completion_tokens ?? 0;
      aiResponse = completion.choices[0]?.message?.content ?? null;
    } catch (err) {
      const shouldFallback =
        (isOpenAIQuotaError(err) || err instanceof CircuitOpenError) && isClaudeFallbackAvailable();
      if (!shouldFallback) throw err;
      auditLog({
        event: 'fallback.claude',
        data: {
          reason: err instanceof CircuitOpenError ? 'circuit_open' : 'openai_quota',
          error: err instanceof Error ? err.message : String(err),
          conversationId,
        },
      });
      const claudeRes = await claudeComplete({
        system: GOVERNANCE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
        maxTokens: 4000,
        jsonOnly: true,
      });
      usedProvider = 'claude';
      usedModel = claudeRes.model;
      promptTokens = claudeRes.usage.input_tokens;
      completionTokens = claudeRes.usage.output_tokens;
      aiResponse = claudeRes.content;
    }

    auditLog({
      event: usedProvider === 'openai' ? 'openai.completed' : 'claude.completed',
      data: {
        provider: usedProvider,
        model: usedModel,
        modelTier: modelChoice.tier,
        modelReason: modelChoice.reason,
        promptTokens,
        cachedPromptTokens: cachedTokens,
        completionTokens,
        durationMs: Date.now() - startTime,
      },
    });

    // ── Record token usage (fire-and-forget) ──
    if (!isGuest) {
      recordTokenUsage({
        userId: session.user.id,
        endpoint: 'advisor',
        promptTokens,
        completionTokens,
        model: usedModel,
      });
    }

    if (!aiResponse) throw new Error('No response from AI service');

    // ── Parse & validate ──
    const parsed = parseAdvisorResponse(aiResponse);
    const parseFellBack =
      parsed.mode === 'clarification' &&
      Array.isArray(parsed.followUpQuestions) &&
      parsed.followUpQuestions[0]?.startsWith('What AI system or tool are you assessing');
    if (parseFellBack) {
      auditLog({
        event: 'advisor.parse.fallback',
        data: {
          provider: usedProvider,
          conversationId,
          contentLength: aiResponse.length,
          contentHead: aiResponse.slice(0, 400),
          contentTail: aiResponse.slice(-200),
        },
      });
    }
    let dbConversationId = isGuest ? 'guest' : conversationId;
    if (!isGuest) {
      dbConversationId = await ensureConversation(session.user.id, query, conversationId);
    }

    const validated = buildValidatedResponse(parsed, dbConversationId!, ragResult);
    if (!validated.success) {
      auditLog({ event: 'response.fallback', data: { reason: 'response_validation_failed' } });
      return NextResponse.json(validated.fallback);
    }

    // ── Citation validation (Phase 1.6 hallucination guardrail) ──
    const citations = validateCitations(flattenStrings(validated.data));
    const unverified = unverifiedCitations(citations);
    if (unverified.length > 0) {
      auditLog({
        event: 'citation.unverified',
        data: {
          conversationId: dbConversationId,
          count: unverified.length,
          citations: unverified.map((c) => ({ cited: c.cited, type: c.type, reason: c.reason })),
        },
      });
      if (process.env.NODE_ENV === 'production' && unverified.length > STRIP_THRESHOLD) {
        validated.data.warnings = [
          ...(validated.data.warnings ?? []),
          `${unverified.length} citation(s) could not be verified against the seed corpus and were flagged for review.`,
        ];
      }
    }

    // ── Persist messages ──
    if (!isGuest) {
      await persistMessages(dbConversationId!, query, JSON.stringify(validated.data), validated.data.riskProfile.level, validated.data.riskProfile.confidence);
    }

    auditLog({
      event: 'response.validated',
      data: { conversationId: validated.data.conversationId, riskLevel: validated.data.riskProfile.level, policyCount: validated.data.suggestedPolicies.length, ragDocsUsed: ragResult.documents.length, isGuest },
    });

    // ── Intent detection & orchestrator dispatch ──
    // Skipped when we fell back to Claude — the orchestrator pipeline still
    // calls OpenAI directly, so it will hit the same quota/circuit failure.
    let generatedArtifact = undefined;
    let dispatch: Awaited<ReturnType<typeof dispatchOrchestrator>> | undefined;
    if (process.env.OPENAI_API_KEY && !isGuest && usedProvider === 'openai') {
      dispatch = await dispatchOrchestrator({
        userId: session.user.id,
        conversationId: dbConversationId,
        role,
        query,
        riskLevel: validated.data.riskProfile.level,
        apiKey: process.env.OPENAI_API_KEY,
        llmIntent: validated.data.intent,
        hasExistingThread: hasConversationHistory,
      });
      generatedArtifact = dispatch.artifact;

      if (dispatch.artifact) {
        auditLog({ event: 'artifact.generated', data: { intentType: dispatch.intentUsed.type, artifactId: dispatch.artifact.id, contested: dispatch.contested } });
        trackEvent({ userId: session.user.id, event: 'artifact_generated', category: dispatch.intentUsed.type, metadata: { artifactId: dispatch.artifact.id } });
      }
      if (dispatch.orchestratorError) {
        auditLog({ event: 'orchestrator.error', data: dispatch.orchestratorError });
        trackEvent({ userId: session.user.id, event: 'error', category: 'orchestrator', metadata: dispatch.orchestratorError });
      }

      // Intake form not yet complete — replace the LLM's generic clarifier
      // with the GovSecure-form-specific questions the user actually needs
      // to answer before scoring. Switches the response into clarification
      // mode so the UI doesn't render the (now-misleading) risk profile.
      if (dispatch.intakeNeedsMoreInfo) {
        validated.data.mode = 'clarification';
        validated.data.followUpQuestions = dispatch.intakeNeedsMoreInfo.questions;
      }
    }

    // ── Overlay GovSecure suite recommendations on top of LLM suggestions ──
    // Replaces invented generic policies (e.g. "Data Privacy and Security
    // Policy", "AI System Monitoring and Evaluation Policy") with the
    // canonical GovSecure Suite Map titles the client will receive in
    // their licensed delivery. Also re-ranks regulations using sector +
    // jurisdiction signals so financial-services intakes lead with
    // GLBA/CFPB/SEC instead of GDPR.
    //
    // Runs for BOTH authenticated and guest sessions. When a conversationId
    // exists we read the persisted org/intake profile; otherwise we infer
    // them inline from the current query + prior thread context (passed in
    // `context`) so guest users get the same Suite Map intelligence.
    let rankedRegulationIds: string[] = [];
    // Build-marker log — appears once per cold start when the overlay code
    // path runs. Lets us verify from server console whether the new build
    // is actually loaded after a dev-server restart.
    const markerHolder = globalThis as { __advisorOverlayBuildMarkerLogged?: boolean };
    if (!markerHolder.__advisorOverlayBuildMarkerLogged) {
      console.log('[advisor] policy/reg overlay v2026-05-12 active — Suite Map + rankRegulationsForContext + intake gating');
      markerHolder.__advisorOverlayBuildMarkerLogged = true;
    }
    if (!dispatch?.intakeNeedsMoreInfo) {
      try {
        let orgCtx: OrgContext;
        let intakeProf: IntakeProfile;
        if (dbConversationId) {
          [orgCtx, intakeProf] = await Promise.all([
            getOrgContext(dbConversationId),
            getIntakeProfile(dbConversationId),
          ]);
        } else {
          // Guest path — derive from current turn + thread history.
          const inlineSource = `${context ?? ''}\n${query}`;
          orgCtx = extractOrgContextFromText(inlineSource) as OrgContext;
          intakeProf = mergeIntakeProfile({}, extractIntakeProfileFromText(inlineSource));
        }
        const tier = generatedArtifact && (generatedArtifact.data as { riskTier?: string })?.riskTier;
        const policyCtx = {
          hasExistingFramework: false,
          riskTier: tier as 'Low' | 'Medium' | 'High' | 'Critical' | undefined,
          customerFacing:
            intakeProf.deploymentScope === 'Customer-facing' ||
            intakeProf.deploymentScope === 'Public-facing',
          handlesSensitiveData: Boolean(
            intakeProf.dataCategories?.personalOrSensitive ||
              intakeProf.dataCategories?.financialOrRegulated,
          ),
          industry: orgCtx.industry,
        };
        const govsecure = recommendPolicies(policyCtx).map(toPolicyRecommendation);
        if (govsecure.length) {
          // Prefer GovSecure titles; keep any LLM suggestion whose title
          // does NOT collide with a canonical GovSecure title.
          const canonical = new Set(govsecure.map(p => p.title.toLowerCase()));
          const llmKeepers = (validated.data.suggestedPolicies ?? []).filter(
            p => !canonical.has(p.title.toLowerCase()),
          );
          validated.data.suggestedPolicies = [...govsecure, ...llmKeepers];
        }

        const ranked = rankRegulationsForContext({
          query,
          industry: orgCtx.industry,
          jurisdictions: orgCtx.jurisdictions,
          customerFacing: policyCtx.customerFacing,
        });
        if (ranked.length) {
          validated.data.regulationCheck = ranked.map(r => ({
            regulation: r.shortName,
            article: r.keyProvisions[0]?.provision ?? r.name,
            relevance: 'high' as const,
            description: r.summary.slice(0, 280),
          }));
          rankedRegulationIds = ranked.map(r => r.id);
        }
      } catch (err) {
        // Non-fatal — overlay is enrichment, not core path.
        console.warn('[advisor] policy/reg overlay failed:', err);
      }
    }

    // ── Apply gating & respond ──
    const finalResponse = applyGating(validated.data, role, generatedArtifact);

    // ── Surface orchestrator error to client ──
    if (generatedArtifact === undefined && dispatch?.orchestratorError) {
      (finalResponse as Record<string, unknown>).orchestratorError = dispatch.orchestratorError;
    }

    // ── Surface intake-needs-more-info to client (non-fatal hint) ──
    if (dispatch?.intakeNeedsMoreInfo) {
      (finalResponse as Record<string, unknown>).intakeNeedsMoreInfo = {
        missingFields: dispatch.intakeNeedsMoreInfo.missingFields,
        completeness: dispatch.intakeNeedsMoreInfo.completeness,
      };
    }

    // ── Surface server-ranked regulation IDs so the client renders the
    // sector/jurisdiction-aware list (not the keyword-only `matchRegulations`
    // fallback). Client maps IDs to full `EmergingRegulation` objects locally.
    if (rankedRegulationIds.length) {
      (finalResponse as Record<string, unknown>).rankedRegulationIds = rankedRegulationIds;
    }

    // ── Cache the response ──
    advisorCache.set(cacheKey, finalResponse);

    return NextResponse.json(finalResponse, { headers: rateLimitHeaders });

  } catch (error) {
    // ── Prompt injection blocked ──
    if (error instanceof PromptInjectionError) {
      return NextResponse.json(
        { error: error.message, code: 'PROMPT_INJECTION_BLOCKED' },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    // ── Circuit breaker open → fast-fail ──
    if (error instanceof CircuitOpenError) {
      auditLog({ event: 'circuit.open', data: { retryAfterMs: error.retryAfterMs, conversationId } });
      return NextResponse.json(
        buildFallbackResponse('AI service temporarily unavailable. Please try again shortly.', conversationId),
        { status: 503, headers: { 'Retry-After': String(Math.ceil(error.retryAfterMs / 1000)) } },
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isQuotaError = errorMessage.includes('429') || errorMessage.includes('quota');
    auditLog({ event: 'request.failed', data: { reason: isQuotaError ? 'quota_exceeded' : 'unhandled_error', error: errorMessage, conversationId, durationMs: Date.now() - startTime } });

    if (isQuotaError) {
      return NextResponse.json(buildFallbackResponse('OpenAI quota exceeded - using demo response', conversationId));
    }
    return NextResponse.json({ error: 'Failed to process AI governance request', details: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ message: 'AI Governance Advisor API', version: '2.0.0', status: 'active' });
}