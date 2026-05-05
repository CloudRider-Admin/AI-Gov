import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { advisorRequestSchema } from '@/lib/ai/schemas';
import { auditLog } from '@/lib/utils/logger';
import { buildEnhancedRAGContext } from '@/lib/ai/rag';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { ensureConversation, persistMessages } from '@/lib/conversation';
import { checkTokenBudget, recordTokenUsage, countTokens } from '@/lib/tokenBudget';
import { openaiCircuit, CircuitOpenError } from '@/lib/circuitBreaker';
import { streamBuffer } from '@/lib/streamBuffer';
import { buildRateLimitHeaders } from '@/lib/rateLimitHeaders';
import { guardInput, PromptInjectionError } from '@/lib/security/promptGuard';
import { parseAdvisorResponse, buildValidatedResponse } from '@/lib/ai/responseParser';
import { dispatchOrchestrator } from '@/lib/ai/orchestratorDispatch';
import { trackEvent } from '@/lib/analytics';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
} as const;

function sseErrorResponse(message: string, status: number, extra?: Record<string, unknown>, extraHeaders?: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const event = JSON.stringify({ type: 'error', error: message, ...extra });
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { ...SSE_HEADERS, ...extraHeaders } });
}

function generateStreamId(): string {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
- WHAT specific AI system or use case they're working with
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

Examples of queries with SUFFICIENT context (provide full assessment):
- "Assess the risk of our customer service chatbot that uses GPT-4 to handle insurance claims"
- "Generate a DPIA for our hiring AI that screens resumes using ML classification"

═══════════════════════════════════════════════════════════════

When you DO have enough context to provide a full assessment:
1. Risk assessment (low/medium/high/critical) with confidence score
2. Specific policy recommendations with priorities
3. Relevant regulatory requirements
4. Actionable next steps
5. Follow-up questions to refine the assessment further

Be practical, actionable, and focused on SMB constraints (limited resources, need for quick implementation).

You MUST respond with a JSON object using EXACTLY these field names:
{
  "mode": "assessment" | "clarification",
  "riskProfile": {
    "level": "low" | "medium" | "high" | "critical",
    "description": "A 2-4 sentence summary (or explanation of what context you need if in clarification mode)",
    "confidence": 0.0 to 1.0,
    "reasoning": ["bullet point 1", "bullet point 2", ...]
  },
  "suggestedPolicies": [
    {
      "title": "Policy name",
      "description": "What this policy covers and why it matters",
      "priority": "high" | "medium" | "low",
      "category": "governance" | "compliance" | "security" | "data" | "ethics"
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

const HEARTBEAT_INTERVAL_MS = 15_000; // 15 seconds

/**
 * GET /api/advisor/stream?resume=<streamId>&offset=<n>
 * Resume a disconnected stream from the given offset.
 */
export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return sseErrorResponse('Unauthorized', 401);
  }

  const streamId = request.nextUrl.searchParams.get('resume');
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10);

  if (!streamId) {
    return sseErrorResponse('Missing resume parameter', 400);
  }

  const buffered = streamBuffer.getFrom(streamId, offset);
  if (!buffered) {
    return sseErrorResponse('Stream not found or expired', 404);
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      // Send remaining content
      if (buffered.content) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: buffered.content })}\n\n`));
      }

      // If stream was complete, send complete event
      if (buffered.complete) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          stage: 'done',
          timestamp: new Date().toISOString(),
          conversationId: streamBuffer.getConversationId(streamId),
          sources: buffered.sources ?? [],
        })}\n\n`));
      }

      controller.close();
    },
  });

  return new Response(readable, { headers: SSE_HEADERS });
}

/**
 * POST /api/advisor/stream
 * Streaming advisor endpoint with error recovery support.
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return sseErrorResponse('Unauthorized', 401);
  }

  const role = session.user.role ?? 'FREE';

  const rateCheck = await checkRateLimit(session.user.id, '/api/advisor/stream', role);
  const rateLimitHeaders = buildRateLimitHeaders(rateCheck);
  if (!rateCheck.allowed) {
    return sseErrorResponse('Rate limit exceeded. Try again later.', 429, { retryAfter: rateCheck.retryAfter }, rateLimitHeaders);
  }

  // ── Token budget check ──
  const budget = await checkTokenBudget(session.user.id, role);
  if (!budget.allowed) {
    auditLog({ event: 'token.budget_exceeded', data: { userId: session.user.id, used: budget.used, limit: budget.limit } });
    return sseErrorResponse('Monthly token budget exceeded. Upgrade your plan for more capacity.', 429);
  }

  const startTime = Date.now();
  let conversationId: string | undefined;

  try {
    const body = await request.json();
    const parseResult = advisorRequestSchema.safeParse(body);
    if (!parseResult.success) {
      auditLog({ event: 'request.failed', data: { reason: 'validation_error', errors: parseResult.error.flatten(), stream: true } });
      return sseErrorResponse('Invalid request', 400);
    }

    const { context } = parseResult.data;
    conversationId = parseResult.data.conversationId;

    // ── Prompt injection guard ──
    const query = guardInput(parseResult.data.query, {
      userId: session.user.id,
      endpoint: '/api/advisor/stream',
    });

    auditLog({ event: 'request.received', data: { queryLength: query.length, hasContext: !!context, conversationId, stream: true } });

    if (!process.env.OPENAI_API_KEY) {
      return sseErrorResponse('OpenAI API key not configured', 500);
    }

    // ── Conversation persistence ──
    const dbConversationId = await ensureConversation(session.user.id, query, conversationId);

    // ── Stream buffer for recovery ──
    const streamId = generateStreamId();
    streamBuffer.create(streamId, dbConversationId);

    // ── RAG context ──
    const ragResult = await buildEnhancedRAGContext(query, { totalBudget: 7 });
    let contextualQuery = query;
    const hasConversationHistory = !!context;
    if (context) contextualQuery = `${context}\n\nNew message from the user: ${query}`;
    if (ragResult.context) contextualQuery = `${ragResult.context}\n\n${contextualQuery}`;

    // ── OpenAI streaming call (with circuit breaker) ──
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await openaiCircuit.execute(() =>
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
        stream: true,
        response_format: { type: 'json_object' },
      }),
    );

    const encoder = new TextEncoder();
    let accumulatedContent = '';

    const readable = new ReadableStream({
      async start(controller) {
        // Heartbeat interval to detect stale connections
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, HEARTBEAT_INTERVAL_MS);

        try {
          // Stage 1: metadata (includes streamId for recovery)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'metadata',
            stage: 'analyzing',
            conversationId: dbConversationId,
            streamId,
            timestamp: new Date().toISOString(),
          })}\n\n`));

          // Stage 2: streaming content
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              accumulatedContent += content;
              streamBuffer.append(streamId, content);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`));
            }
          }

          // Stage 3: persist
          await persistMessages(dbConversationId, query, accumulatedContent);

          // Stage 3b: parse response and dispatch orchestrator for artifact generation
          let artifactData: Record<string, unknown> | undefined;
          try {
            const parsed = parseAdvisorResponse(accumulatedContent);
            const validated = buildValidatedResponse(parsed, dbConversationId, ragResult);
            if (validated.success && validated.data.mode !== 'clarification') {
              const dispatch = await dispatchOrchestrator({
                userId: session.user.id,
                conversationId: dbConversationId,
                role,
                query,
                riskLevel: validated.data.riskProfile.level,
                apiKey: process.env.OPENAI_API_KEY!,
                llmIntent: validated.data.intent,
                hasExistingThread: hasConversationHistory,
              });
              if (dispatch.artifact) {
                artifactData = { type: dispatch.artifact.type, id: dispatch.artifact.id, data: dispatch.artifact.data };
                auditLog({ event: 'artifact.generated', data: { intentType: dispatch.intentUsed.type, artifactId: dispatch.artifact.id, stream: true } });
                trackEvent({ userId: session.user.id, event: 'artifact_generated', category: dispatch.intentUsed.type, metadata: { artifactId: dispatch.artifact.id } });
              }
              if (dispatch.orchestratorError) {
                auditLog({ event: 'orchestrator.error', data: { ...dispatch.orchestratorError, stream: true } });
              }
            }
          } catch (orchErr) {
            console.error('[stream] orchestrator dispatch failed:', orchErr);
          }

          // Stage 4: complete
          streamBuffer.complete(streamId, ragResult.sources);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            stage: 'done',
            timestamp: new Date().toISOString(),
            conversationId: dbConversationId,
            streamId,
            ragDocsUsed: ragResult.sources.length,
            sources: ragResult.sources,
            ...(artifactData ? { artifact: artifactData } : {}),
          })}\n\n`));

          const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
          auditLog({
            event: 'openai.completed',
            data: { model, stream: true, durationMs: Date.now() - startTime, ragDocsUsed: ragResult.sources.length },
          });

          // Accurate token count using gpt-tokenizer
          const estimatedTokens = countTokens(accumulatedContent);
          recordTokenUsage({
            userId: session.user.id,
            endpoint: 'advisor/stream',
            promptTokens: 0, // not available in streaming
            completionTokens: estimatedTokens,
            model,
          });
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            streamId,
            resumeOffset: accumulatedContent.length,
          })}\n\n`));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });

    return new Response(readable, { headers: { ...SSE_HEADERS, ...rateLimitHeaders } });

  } catch (error) {
    // ── Prompt injection blocked ──
    if (error instanceof PromptInjectionError) {
      return sseErrorResponse(error.message, 400, { code: 'PROMPT_INJECTION_BLOCKED' }, rateLimitHeaders);
    }

    // ── Circuit breaker open → fast-fail ──
    if (error instanceof CircuitOpenError) {
      auditLog({ event: 'circuit.open', data: { retryAfterMs: error.retryAfterMs, conversationId, stream: true } });
      return sseErrorResponse('AI service temporarily unavailable. Please try again shortly.', 503);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isQuotaError = errorMessage.includes('429') || errorMessage.includes('quota');
    auditLog({ event: 'request.failed', data: { reason: isQuotaError ? 'quota_exceeded' : 'unhandled_error', error: errorMessage, conversationId, stream: true, durationMs: Date.now() - startTime } });

    if (isQuotaError) {
      return sseErrorResponse('OpenAI quota exceeded. Please try again later.', 429);
    }
    return sseErrorResponse('Failed to process streaming request', 500);
  }
}