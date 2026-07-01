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
import { classifyIntent } from '@/lib/ai/intentClassifier';
import { pickAdvisorModel } from '@/lib/ai/modelRouter';
import { trackEvent } from '@/lib/analytics';
import { GOVERNANCE_SYSTEM_PROMPT } from '@/lib/ai/systemPrompt';
import { unverifiedCitations, validateCitations } from '@/lib/ai/citationValidator';
import { claudeStream, isOpenAIQuotaError, isClaudeFallbackAvailable } from '@/lib/ai/claudeFallback';

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

    // ── RAG context (includes the user's own uploaded documents) ──
    const ragResult = await buildEnhancedRAGContext(query, {
      totalBudget: 7,
      userId: session.user.id,
    });
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

    const userMessage = hasConversationHistory
      ? `${contextualQuery}\n\nThe user is continuing an existing conversation with established context. Provide a full assessment (mode: "assessment") incorporating all context. Respond with a JSON object containing: mode, riskProfile, suggestedPolicies, regulationCheck, followUpQuestions, sources, and intent.`
      : `${contextualQuery}\n\nFirst determine if this query provides enough context for a full assessment or if you need to ask clarifying questions. Then respond with a JSON object containing: mode, riskProfile, suggestedPolicies, regulationCheck, followUpQuestions, sources, and intent.`;

    // ── OpenAI streaming call (with circuit breaker), Claude fallback on quota/circuit-open ──
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let provider: 'openai' | 'claude' = 'openai';
    let textStream: AsyncIterable<string>;
    let providerModel = modelChoice.model;

    try {
      const openaiStream = await openaiCircuit.execute(() =>
        openai.chat.completions.create({
          model: modelChoice.model,
          messages: [
            { role: 'system', content: GOVERNANCE_SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 4000,
          stream: true,
          response_format: { type: 'json_object' },
        }),
      );
      textStream = (async function* () {
        for await (const chunk of openaiStream) {
          const c = chunk.choices[0]?.delta?.content || '';
          if (c) yield c;
        }
      })();
    } catch (err) {
      const shouldFallback =
        (isOpenAIQuotaError(err) || err instanceof CircuitOpenError) && isClaudeFallbackAvailable();
      if (!shouldFallback) throw err;
      auditLog({
        event: 'fallback.claude',
        data: {
          reason: err instanceof CircuitOpenError ? 'circuit_open' : 'openai_quota',
          error: err instanceof Error ? err.message : String(err),
          conversationId: dbConversationId,
          stream: true,
        },
      });
      provider = 'claude';
      providerModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
      textStream = claudeStream({
        system: GOVERNANCE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
        maxTokens: 4000,
        jsonOnly: true,
      });
    }

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

          // Stage 2: streaming content (unified text deltas across providers)
          for await (const content of textStream) {
            if (content) {
              accumulatedContent += content;
              streamBuffer.append(streamId, content);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`));
            }
          }

          // Stage 3: persist
          await persistMessages(dbConversationId, query, accumulatedContent);

          // Stage 3a: citation validation (Phase 1.6 hallucination guardrail)
          // Streaming has already shipped the prose to the client by this
          // point, so we cannot strip — we log only and let the eval harness
          // catch regressions.
          const citations = validateCitations(accumulatedContent);
          const unverified = unverifiedCitations(citations);
          if (unverified.length > 0) {
            auditLog({
              event: 'citation.unverified',
              data: {
                conversationId: dbConversationId,
                stream: true,
                count: unverified.length,
                citations: unverified.slice(0, 10).map((c) => ({ cited: c.cited, type: c.type, reason: c.reason })),
              },
            });
          }

          // Stage 3b: parse response and dispatch orchestrator for artifact generation
          let artifactData: Record<string, unknown> | undefined;
          try {
            const parsed = parseAdvisorResponse(accumulatedContent);
            // Diagnostic: when the parser falls back to clarification because
            // JSON.parse + repair both failed, log a sample of what the model
            // actually emitted so the failure is debuggable in production.
            const parseFellBack =
              parsed.mode === 'clarification' &&
              Array.isArray(parsed.followUpQuestions) &&
              parsed.followUpQuestions[0]?.startsWith('What AI system or tool are you assessing');
            if (parseFellBack) {
              auditLog({
                event: 'advisor.parse.fallback',
                data: {
                  provider,
                  conversationId: dbConversationId,
                  contentLength: accumulatedContent.length,
                  contentHead: accumulatedContent.slice(0, 400),
                  contentTail: accumulatedContent.slice(-200),
                },
              });
            }
            const validated = buildValidatedResponse(parsed, dbConversationId, ragResult);
            // Orchestrator pipeline still calls OpenAI directly — skip when we
            // fell back to Claude so we don't trip the same quota/circuit error.
            if (validated.success && validated.data.mode !== 'clarification' && provider === 'openai') {
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

          auditLog({
            event: provider === 'openai' ? 'openai.completed' : 'claude.completed',
            data: {
              provider,
              model: providerModel,
              modelTier: modelChoice.tier,
              modelReason: modelChoice.reason,
              stream: true,
              durationMs: Date.now() - startTime,
              ragDocsUsed: ragResult.sources.length,
            },
          });

          // Accurate token count using gpt-tokenizer
          const estimatedTokens = countTokens(accumulatedContent);
          recordTokenUsage({
            userId: session.user.id,
            endpoint: 'advisor/stream',
            promptTokens: 0, // not available in streaming
            completionTokens: estimatedTokens,
            model: providerModel,
          });
        } catch (error) {
          // Surface the actual failure cause to the server log — the SSE
          // "error" event below is generic by design (the client resumes on
          // it), but if we don't log here we lose visibility into mid-stream
          // throws from claudeStream / OpenAI / parser.
          const errMsg = error instanceof Error ? error.message : String(error);
          const errStack = error instanceof Error ? error.stack : undefined;
          auditLog({
            event: 'request.failed',
            data: {
              provider,
              providerModel,
              conversationId: dbConversationId,
              stream: true,
              accumulatedLength: accumulatedContent.length,
              error: errMsg,
              stack: errStack?.split('\n').slice(0, 8).join(' | '),
            },
          });
          console.error('[advisor/stream] mid-stream error:', error);

          // Classify the error: provider billing / credit / quota / auth
          // failures are fatal — there is nothing to resume to. Surface a
          // human-readable message and OMIT resumeOffset so the client
          // throws instead of looping through resume+empty content (which
          // ultimately renders the canned-clarification fallback).
          const lower = errMsg.toLowerCase();
          const fatal =
            accumulatedContent.length === 0 ||
            lower.includes('credit balance') ||
            lower.includes('insufficient_quota') ||
            lower.includes('quota') ||
            lower.includes('billing') ||
            lower.includes('invalid_api_key') ||
            lower.includes('authentication') ||
            lower.includes('unauthorized');

          let userMsg = errMsg;
          if (lower.includes('credit balance')) {
            userMsg = 'Anthropic credit balance is too low. Add credits at https://console.anthropic.com/settings/billing.';
          } else if (lower.includes('insufficient_quota') || (provider === 'openai' && lower.includes('quota'))) {
            userMsg = 'OpenAI quota exceeded. Check your plan & billing at https://platform.openai.com/account/billing.';
          } else if (lower.includes('invalid_api_key') || lower.includes('authentication')) {
            userMsg = `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key is invalid or missing.`;
          }

          const payload: Record<string, unknown> = {
            type: 'error',
            error: userMsg,
            streamId,
          };
          if (!fatal) payload.resumeOffset = accumulatedContent.length;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
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