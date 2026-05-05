import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { advisorRequestSchema, buildFallbackResponse } from '@/lib/ai/schemas';
import { auditLog } from '@/lib/utils/logger';
import { buildEnhancedRAGContext } from '@/lib/ai/rag';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { parseAdvisorResponse, buildValidatedResponse, applyGating } from '@/lib/ai/responseParser';
import { dispatchOrchestrator } from '@/lib/ai/orchestratorDispatch';
import { ensureConversation, persistMessages } from '@/lib/conversation';
import { checkTokenBudget, recordTokenUsage } from '@/lib/tokenBudget';
import { advisorCache, ResponseCache } from '@/lib/responseCache';
import { openaiCircuit, CircuitOpenError } from '@/lib/circuitBreaker';
import { buildRateLimitHeaders } from '@/lib/rateLimitHeaders';
import { guardInput, PromptInjectionError } from '@/lib/security/promptGuard';
import { trackEvent } from '@/lib/analytics';

const GOVERNANCE_SYSTEM_PROMPT = `You are Govi, an AI Governance expert specializing in helping SMBs implement responsible AI practices. Your expertise covers:

- NIST AI Risk Management Framework (AI RMF)
- ISO/IEC 42001 AI Management Systems
- EU AI Act compliance
- GDPR and data protection in AI contexts
- Risk assessment and mitigation strategies
- Policy development and implementation

═══════════════════════════════════════════════════════════════
CRITICAL: CONVERSATIONAL BEHAVIOR — READ THIS FIRST
═══════════════════════════════════════════════════════════════

You are a CONVERSATIONAL advisor, not a report generator. Before providing a full assessment, you MUST determine if the user has given you enough context.

**CLARIFICATION MODE** — Use when the query is VAGUE or GENERIC:
Set "mode": "clarification" when the user:
- Asks for a risk assessment, checklist, or intake without specifying WHAT AI system, use case, or industry
- Says "generate a document" without describing what it's for
- Uses generic terms like "AI risk assessment" without context about their specific situation
- Asks for a template or checklist without specifying the domain

In clarification mode:
- Set "mode": "clarification"
- Ask 3-5 targeted follow-up questions to understand their specific situation
- Questions should cover: What AI system/tool? What industry/sector? What data is involved? Who are the end users? What's the deployment context?
- Keep riskProfile minimal (level: "medium", confidence: 0.3, description explaining you need more context)
- Keep suggestedPolicies and regulationCheck EMPTY — do NOT dump generic policies
- Set intent.type to "advisor" (do NOT trigger generation)

**ASSESSMENT MODE** — Use when you have SUFFICIENT context:
Set "mode": "assessment" when the user has told you:
- WHAT specific AI system or use case they're working with (e.g., "chatbot for customer service", "ML model for loan approvals")
- OR has answered your follow-up questions with specifics
- OR has explicitly said they want a general/generic assessment

In assessment mode, provide your full analysis with risk profile, policies, regulations, etc.

IMPORTANT: When the user originally requested a SPECIFIC action (risk assessment, DPIA, document generation, playbook) and then answered your clarification questions, you MUST set intent.type to match their original request:
- If they asked for a risk assessment / intake → set intent.type to "intake" with extractedUseCaseDescription
- If they asked to generate a document (DPIA, threat model, etc.) → set intent.type to "document" with documentType
- If they asked for a playbook / roadmap → set intent.type to "playbook" with framework
Do NOT downgrade their intent to "advisor" just because the latest message is Q&A answers.

Examples of queries requiring CLARIFICATION (do NOT generate full assessment):
- "Generate an AI intake Risk Assessment Checklist Template"
- "Run a risk assessment"
- "Create a DPIA"
- "I need an AI governance checklist"
- "Assess our AI risk"

Examples of queries with SUFFICIENT context (provide full assessment):
- "Assess the risk of our customer service chatbot that uses GPT-4 to handle insurance claims"
- "Generate a DPIA for our hiring AI that screens resumes using ML classification"
- "We're deploying a facial recognition system in our retail stores, what are the risks?"

═══════════════════════════════════════════════════════════════

When you DO have enough context to provide a full assessment:
1. Risk assessment (low/medium/high/critical) with confidence score
2. Specific policy recommendations with priorities
3. Relevant regulatory requirements
4. Actionable next steps
5. Follow-up questions to refine the assessment further

Be practical, actionable, and focused on SMB constraints (limited resources, need for quick implementation).

For each suggested policy, include a "documentType" field that maps to the most relevant governance document the user can generate:
- "dpia" for data protection / privacy policies
- "threat-model" for security-related policies
- "model-card" for model documentation / transparency policies
- "data-sheet" for data governance / data quality policies
- "human-oversight-statement" for human oversight / accountability policies
- "risk-memo" for risk management / escalation policies
- "use-case-summary" for use case scoping / acceptable use policies
- "vendor-model-facts" for vendor / third-party AI policies
- "operational-readiness-plan" for deployment / operational policies
- "monitoring-plan" for monitoring / audit policies
- "evidence-pack" for compliance evidence / documentation policies

Additionally, classify the user's intent:
- If they explicitly request you to GENERATE a governance document AND have provided sufficient context, set intent.type to "document" and intent.documentType to the matching type.
- If they explicitly request you to RUN an intake risk assessment AND have provided sufficient context, set intent.type to "intake" and extract the use case description.
- If they explicitly request you to CREATE an implementation playbook AND have provided sufficient context, set intent.type to "playbook" and intent.framework to the relevant framework.
- For general advisory questions OR when you need more context, set intent.type to "advisor".

You MUST respond with a JSON object using EXACTLY these field names:
{
  "mode": "assessment" | "clarification",
  "riskProfile": {
    "level": "low" | "medium" | "high" | "critical",
    "description": "A 2-4 sentence summary explaining the overall risk assessment and key concerns (or explaining what context you need if in clarification mode)",
    "confidence": 0.0 to 1.0,
    "reasoning": ["bullet point 1", "bullet point 2", ...]
  },
  "suggestedPolicies": [
    {
      "title": "Policy name",
      "description": "What this policy covers and why it matters",
      "priority": "high" | "medium" | "low",
      "category": "governance" | "compliance" | "security" | "data" | "ethics",
      "documentType": "dpia" | "threat-model" | "model-card" | ... (from the list above)
    }
  ],
  "regulationCheck": [
    {
      "regulation": "Regulation name",
      "article": "Specific article or section",
      "relevance": "high" | "medium" | "low",
      "description": "Why this regulation applies"
    }
  ],
  "followUpQuestions": ["question 1", "question 2", ...],
  "sources": ["source 1", "source 2", ...],
  "intent": { "type": "advisor" }
}

IMPORTANT:
- In "assessment" mode: "description" must be a thorough summary paragraph. "reasoning" must contain 3-5 specific risk factors.
- In "clarification" mode: "description" should explain what you understood and what additional context you need. "followUpQuestions" must contain 3-5 SPECIFIC questions. "suggestedPolicies" and "regulationCheck" should be EMPTY arrays.`;

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

    // ── OpenAI call (with circuit breaker) ──
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openaiCircuit.execute(() =>
      openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o',
        messages: [
          { role: 'system', content: GOVERNANCE_SYSTEM_PROMPT },
          { role: 'user', content: hasConversationHistory
            ? `${contextualQuery}\n\nThe user is continuing an existing conversation with established context. Provide a full assessment (mode: "assessment") incorporating all context. Respond with a JSON object containing: mode, riskProfile, suggestedPolicies, regulationCheck, followUpQuestions, sources, and intent.`
            : `${contextualQuery}\n\nFirst determine if this query provides enough context for a full assessment or if you need to ask clarifying questions. Then respond with a JSON object containing: mode, riskProfile, suggestedPolicies, regulationCheck, followUpQuestions, sources, and intent.` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    );

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    auditLog({
      event: 'openai.completed',
      data: { model, promptTokens: completion.usage?.prompt_tokens, completionTokens: completion.usage?.completion_tokens, durationMs: Date.now() - startTime },
    });

    // ── Record token usage (fire-and-forget) ──
    if (!isGuest) {
      recordTokenUsage({
        userId: session.user.id,
        endpoint: 'advisor',
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        model,
      });
    }

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) throw new Error('No response from AI service');

    // ── Parse & validate ──
    const parsed = parseAdvisorResponse(aiResponse);
    let dbConversationId = isGuest ? 'guest' : conversationId;
    if (!isGuest) {
      dbConversationId = await ensureConversation(session.user.id, query, conversationId);
    }

    const validated = buildValidatedResponse(parsed, dbConversationId!, ragResult);
    if (!validated.success) {
      auditLog({ event: 'response.fallback', data: { reason: 'response_validation_failed' } });
      return NextResponse.json(validated.fallback);
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
    let generatedArtifact = undefined;
    let dispatch: Awaited<ReturnType<typeof dispatchOrchestrator>> | undefined;
    if (process.env.OPENAI_API_KEY && !isGuest) {
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
    }

    // ── Apply gating & respond ──
    const finalResponse = applyGating(validated.data, role, generatedArtifact);

    // ── Surface orchestrator error to client ──
    if (generatedArtifact === undefined && dispatch?.orchestratorError) {
      (finalResponse as Record<string, unknown>).orchestratorError = dispatch.orchestratorError;
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