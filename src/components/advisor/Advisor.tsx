'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Sparkles, Terminal } from 'lucide-react';
import { advisorContent } from '@/data/content';
import { AdvisorInput } from './AdvisorInput';
import { AdvisorLoading } from './AdvisorLoading';
import { AdvisorError } from './AdvisorError';
import { AdvisorResponsePanel } from './AdvisorResponsePanel';
import { AdvisorStreamingPanel } from './AdvisorStreamingPanel';
import { ConversationHistory } from './ConversationHistory';
import { TokenBudgetIndicator } from './TokenBudgetIndicator';
import { parseAdvisorResponse, buildValidatedResponse } from '@/lib/ai/responseParser';
import { matchSectors, type SectorGuidance } from '@/data/sectorGuidance';
import { matchRegulations, type EmergingRegulation } from '@/data/emergingRegulations';
import type { ActionCardAction } from './ActionCardsPanel';
import type { AdvisorResponse, ConversationSummary } from '@/types/advisor';

/** Error that includes stream recovery info (streamId + offset) */
class StreamRecoverableError extends Error {
  constructor(message: string, public streamId: string, public resumeOffset: number) {
    super(message);
    this.name = 'StreamRecoverableError';
  }
}

const GUEST_STORAGE_KEY = 'govi_guest_prompts';

const STARTER_PROMPTS = [
  'We use ChatGPT in our customer support team. What risks should we address?',
  'We\'re building an AI tool to screen CVs for hiring. What regulations apply?',
  'Our startup uses AI to generate marketing content. What governance do we need?',
  'We want to deploy an AI chatbot for financial advice. What are the risks?',
];

interface ThreadEntry {
  query: string;
  response: AdvisorResponse;
  detectedSectors: SectorGuidance[];
  detectedRegulations: EmergingRegulation[];
}

interface AdvisorProps {
  showHeader?: boolean;
  initialQuery?: string;
  initialConversationId?: string;
}

export function Advisor({ showHeader = true, initialQuery, initialConversationId }: AdvisorProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [query, setQuery] = useState(initialQuery ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [guestUsed, setGuestUsed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingStage, setStreamingStage] = useState<string | null>(null);
  const [streamingQuery, setStreamingQuery] = useState<string | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const used = parseInt(localStorage.getItem(GUEST_STORAGE_KEY) ?? '0', 10);
      if (used >= 1) setGuestUsed(true);
    }
  }, [status]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
      if (initialConversationId) {
        handleSelectConversation(initialConversationId);
      }
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when thread grows, loading changes, or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.length, isLoading, streamingText]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // Non-fatal
    }
  };

  const buildConversationContext = (currentThread: ThreadEntry[]): string | undefined => {
    if (currentThread.length === 0) return undefined;

    const lastEntry = currentThread[currentThread.length - 1];

    // Build a full conversation summary so the LLM never loses established facts
    const threadSummary = currentThread.map((entry, idx) => {
      const mode = entry.response.mode === 'clarification' ? '[CLARIFICATION]' : '[ASSESSMENT]';
      const risk = entry.response.mode !== 'clarification'
        ? ` | Risk: ${entry.response.riskProfile.level} (${Math.round((entry.response.riskProfile.confidence ?? 0) * 100)}%)`
        : '';
      return `Exchange ${idx + 1} ${mode}: User asked: "${entry.query.slice(0, 200)}"${risk}\nGovi responded: ${entry.response.riskProfile.description.slice(0, 300)}`;
    }).join('\n\n');

    let instruction: string;
    if (lastEntry.response.mode === 'clarification') {
      instruction = `IMPORTANT: The user is answering your follow-up questions. They are providing additional details you asked for. Use their answers along with ALL previously established context to provide a FULL assessment (mode: "assessment"). Do NOT ask for clarification again unless the answer is truly insufficient.`;
    } else {
      instruction = `IMPORTANT: The user is continuing an existing conversation. They have already established context (see thread history below). Treat their new message as ADDITIONAL information building on what was already discussed. Do NOT ask for clarification on details already provided. Provide a full assessment (mode: "assessment") incorporating both the new information and the established context.`;
    }

    return `${instruction}\n\n═══ CONVERSATION HISTORY ═══\n${threadSummary}\n═══ END HISTORY ═══`;
  };

  const submitQuery = async (queryText: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Build context from the last response for multi-turn awareness
      const context = buildConversationContext(thread);

      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          conversationId: activeConversationId ?? undefined,
          context,
        }),
      });

      if (res.status === 429) {
        const payload = await res.json().catch(() => null);
        const wait = payload?.retryAfter ? ` Try again in ${payload.retryAfter}s.` : '';
        throw new Error(`Rate limit reached.${wait}`);
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? 'Failed to fetch advisor response');
      }

      const data: AdvisorResponse = await res.json();
      const detectedSectors = matchSectors(queryText);
      const detectedRegulations = matchRegulations(queryText, 2);
      setThread((prev) => [...prev, { query: queryText, response: data, detectedSectors, detectedRegulations }]);
      setActiveConversationId(data.conversationId);
      setQuery('');
      setLastFailedQuery(null);
      setBudgetRefreshKey(k => k + 1);

      if (!isAuthenticated) {
        localStorage.setItem(GUEST_STORAGE_KEY, '1');
        setGuestUsed(true);
      } else {
        await fetchConversations();
      }
    } catch (err) {
      setLastFailedQuery(queryText);
      setError(
        err instanceof Error ? err.message : 'Something went wrong while contacting the advisor.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const submitQueryStreaming = async (queryText: string) => {
    setIsLoading(true);
    setError(null);
    setStreamingText('');
    setStreamingStage('analyzing');
    setStreamingQuery(queryText);

    try {
      const context = buildConversationContext(thread);

      const res = await fetch('/api/advisor/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          conversationId: activeConversationId ?? undefined,
          context,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to start streaming response');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let streamConversationId: string | undefined;
      let streamSources: string[] = [];
      let currentStreamId: string | undefined;
      let streamArtifact: { type: string; id: string; data: unknown } | undefined;

      const processStream = async (activeReader: ReadableStreamDefaultReader<Uint8Array>) => {
        while (true) {
          const { done, value } = await activeReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop()!;

          for (const event of events) {
            const dataLine = event.split('\n').find(l => l.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const payload = JSON.parse(dataLine.slice(6));

              if (payload.type === 'heartbeat') {
                // Keep-alive, ignore
                continue;
              } else if (payload.type === 'metadata') {
                setStreamingStage('analyzing');
                streamConversationId = payload.conversationId;
                currentStreamId = payload.streamId;
              } else if (payload.type === 'content') {
                accumulated += payload.content;
                setStreamingText(accumulated);
                setStreamingStage('streaming');
              } else if (payload.type === 'complete') {
                streamSources = payload.sources ?? [];
                streamConversationId = payload.conversationId ?? streamConversationId;
                if (payload.artifact) {
                  streamArtifact = payload.artifact;
                }
              } else if (payload.type === 'error') {
                // Try to resume if we have a streamId
                if (currentStreamId && payload.resumeOffset !== undefined) {
                  throw new StreamRecoverableError(payload.error ?? 'Stream error', currentStreamId, payload.resumeOffset);
                }
                throw new Error(payload.error ?? 'Streaming error');
              }
            } catch (e) {
              if (e instanceof StreamRecoverableError) throw e;
              if (e instanceof Error && e.message !== 'Streaming error') continue;
              throw e;
            }
          }
        }
      };

      // Process the main stream with up to 2 automatic resume attempts
      let retries = 0;
      const maxRetries = 2;

      try {
        await processStream(reader);
      } catch (err) {
        if (err instanceof StreamRecoverableError && retries < maxRetries) {
          // Attempt to resume from where we left off
          while (retries < maxRetries) {
            retries++;
            setStreamingStage('reconnecting');
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
              const resumeRes = await fetch(`/api/advisor/stream?resume=${err.streamId}&offset=${accumulated.length}`);
              if (!resumeRes.ok || !resumeRes.body) {
                throw new Error('Resume failed');
              }
              const resumeReader = resumeRes.body.getReader();
              buffer = '';
              await processStream(resumeReader);
              break; // Success
            } catch {
              if (retries >= maxRetries) {
                throw new Error('Stream disconnected. Please try again.');
              }
            }
          }
        } else {
          throw err;
        }
      }

      // Parse accumulated JSON into structured response
      const parsed = parseAdvisorResponse(accumulated);
      const ragResult = { context: null, documents: [], sources: streamSources };
      const validated = buildValidatedResponse(parsed, streamConversationId ?? 'stream', ragResult);

      const response = validated.success
        ? validated.data
        : { ...validated.fallback, conversationId: streamConversationId ?? `stream_${Date.now()}` } as AdvisorResponse;

      // Attach artifact from orchestrator dispatch (if generated server-side during stream)
      if (streamArtifact && !response.generatedArtifact) {
        response.generatedArtifact = streamArtifact;
      }

      const detectedSectors = matchSectors(queryText);
      const detectedRegulations = matchRegulations(queryText, 2);
      setThread(prev => [...prev, { query: queryText, response, detectedSectors, detectedRegulations }]);
      setActiveConversationId(response.conversationId);
      setQuery('');
      setLastFailedQuery(null);
      setBudgetRefreshKey(k => k + 1);
      await fetchConversations();
    } catch (err) {
      setLastFailedQuery(queryText);
      setError(err instanceof Error ? err.message : 'Streaming failed.');
    } finally {
      setIsLoading(false);
      setStreamingText(null);
      setStreamingStage(null);
      setStreamingQuery(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setFollowUpPrompt(null);
    // Authenticated users get streaming; guests get non-streaming
    if (isAuthenticated) {
      await submitQueryStreaming(query);
    } else {
      await submitQuery(query);
    }
  };

  const handleFollowUp = (question: string) => {
    // In clarification mode, populate the input with the question as a prompt
    // so the user can type their own answer — don't auto-submit
    setQuery('');
    setFollowUpPrompt(question);
    // Scroll to the input area so the user sees the prompt
    setTimeout(() => {
      inputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleAnswersSubmit = async (answers: { question: string; answer: string }[]) => {
    // Find the original query that triggered clarification so intent is preserved
    const lastClarification = [...thread].reverse().find(
      (entry) => entry.response.mode === 'clarification'
    );
    const originalQuery = lastClarification?.query ?? '';

    // Combine: repeat the original request + user's answers so the intent
    // classifier sees the generation verb ("risk assessment", "generate DPIA", etc.)
    const answersBlock = answers
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join('\n\n');

    const combined = originalQuery
      ? `${originalQuery}\n\nHere are the details you asked for:\n${answersBlock}`
      : answersBlock;

    setFollowUpPrompt(null);
    if (isAuthenticated) {
      await submitQueryStreaming(combined);
    } else {
      await submitQuery(combined);
    }
  };

  const handleStarterPrompt = (prompt: string) => {
    setQuery(prompt);
  };

  const handleReset = () => {
    setQuery('');
    setThread([]);
    setError(null);
  };

  const handleActionCard = async (action: ActionCardAction) => {
    setActionLoading(true);
    setError(null);

    const endpointMap: Record<string, string> = {
      intake: '/api/intake',
      document: '/api/documents',
      playbook: '/api/playbooks',
    };

    try {
      let body: Record<string, unknown>;
      if (action.type === 'intake') {
        body = { useCaseDescription: action.useCaseDescription, conversationId: activeConversationId };
      } else if (action.type === 'document') {
        const lastResponse = thread[thread.length - 1]?.response;
        const riskTier = lastResponse
          ? lastResponse.riskProfile.level === 'critical'
            ? 'Critical'
            : lastResponse.riskProfile.level.charAt(0).toUpperCase() + lastResponse.riskProfile.level.slice(1)
          : 'Medium';
        body = {
          documentType: action.documentType,
          riskTier,
          useCaseDescription: action.useCaseDescription,
          conversationId: activeConversationId,
        };
      } else {
        const lastResponse = thread[thread.length - 1]?.response;
        const riskTier = lastResponse
          ? lastResponse.riskProfile.level === 'critical'
            ? 'Critical'
            : lastResponse.riskProfile.level.charAt(0).toUpperCase() + lastResponse.riskProfile.level.slice(1)
          : 'Medium';
        body = {
          framework: action.framework,
          riskTier,
          useCaseDescription: action.useCaseDescription,
          conversationId: activeConversationId,
        };
      }

      const res = await fetch(endpointMap[action.type], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? 'Failed to generate document');
      }

      const result = await res.json();

      // Attach artifact to the last thread entry's response
      setThread((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          response: {
            ...updated[lastIdx].response,
            generatedArtifact: {
              type: action.type,
              id: result.artifactId ?? result.id ?? 'unknown',
              data: result,
            },
          },
        };
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document generation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNewConversation = () => {
    handleReset();
    setActiveConversationId(null);
  };

  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    setThread([]);
    setError(null);
    setQuery('');

    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return;

      const conv = await res.json();
      const messages: { role: string; content: string }[] = conv.messages ?? [];
      const reconstructed: ThreadEntry[] = [];

      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user') {
          const userMsg = messages[i];
          const assistantMsg = messages[i + 1];
          if (assistantMsg?.role === 'assistant') {
            try {
              const parsed: AdvisorResponse = JSON.parse(assistantMsg.content);
              reconstructed.push({
                query: userMsg.content,
                response: parsed,
                detectedSectors: matchSectors(userMsg.content),
                detectedRegulations: matchRegulations(userMsg.content, 2),
              });
              i++; // skip assistant message on next iteration
            } catch {
              // Skip unparseable entries
            }
          }
        }
      }

      setThread(reconstructed);
    } catch {
      // Non-fatal
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) handleNewConversation();
    } catch {
      // Non-fatal
    }
  };

  const guestGate = (
    <div className="text-center py-10">
      <p className="text-terminal-green font-mono text-sm uppercase tracking-wider mb-2">
        Free prompt used
      </p>
      <p className="text-terminal-muted font-mono text-sm mb-6">
        Sign in to continue using Govi and save your conversation history.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/signin" className="btn-secondary text-sm py-2">
          Sign In
        </Link>
        <Link href="/signup" className="btn-primary text-sm py-2">
          Sign Up
        </Link>
      </div>
    </div>
  );

  const showStarterPrompts =
    thread.length === 0 && !isLoading && !error && query.length === 0 && !(!isAuthenticated && guestUsed);

  return (
    <section id="advisor" className="section scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        {showHeader && (
          <div className="text-center mb-12">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-2 block">
              Interactive Tool
            </span>
            <h2 className="section-title flex items-center justify-center gap-3">
              <Sparkles className="w-8 h-8 text-terminal-green" />
              {advisorContent.title}
            </h2>
            <p className="section-subtitle mx-auto">{advisorContent.description}</p>
          </div>
        )}

        <div className="flex gap-4 items-start">
          {isAuthenticated && (
            <ConversationHistory
              conversations={conversations}
              activeId={activeConversationId}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen((v) => !v)}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onDelete={handleDeleteConversation}
            />
          )}

          <div className="flex-1 terminal-window glow-green min-w-0">
            <div className="terminal-header">
              <div className="terminal-dot bg-red-500" />
              <div className="terminal-dot bg-yellow-500" />
              <div className="terminal-dot bg-green-500" />
              <div className="flex items-center gap-2 ml-4">
                <Terminal className="w-4 h-4 text-terminal-muted" />
                <span className="text-xs text-terminal-muted font-mono">Govi v1.0</span>
                {isAuthenticated && session?.user?.role && (
                  <span className="text-xs text-terminal-green font-mono opacity-60">
                    [{session.user.role}]
                  </span>
                )}
                {thread.length > 0 && (
                  <span className="text-xs text-terminal-muted font-mono opacity-60 ml-2">
                    · {thread.length} exchange{thread.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {isAuthenticated && <TokenBudgetIndicator refreshKey={budgetRefreshKey} />}

            <div className="p-6">
              {/* Starter prompts — shown only on empty state */}
              {showStarterPrompts && (
                <div className="mb-6">
                  <p className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-3">
                    Try asking about...
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STARTER_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleStarterPrompt(prompt)}
                        className="text-xs font-mono px-3 py-1.5 border border-terminal-border rounded-full text-terminal-muted hover:border-terminal-green hover:text-terminal-green transition-colors text-left"
                      >
                        {prompt.length > 65 ? prompt.slice(0, 65) + '…' : prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input or guest gate */}
              <div ref={inputAreaRef}>
                {!isAuthenticated && guestUsed ? (
                  guestGate
                ) : (
                  <AdvisorInput
                    query={query}
                    isLoading={isLoading}
                    hasContent={thread.length > 0 || query.length > 0 || !!error}
                    onChange={setQuery}
                    onSubmit={handleSubmit}
                    onReset={handleReset}
                    placeholder={followUpPrompt ?? undefined}
                  />
                )}
              </div>

              {error && (
                <AdvisorError
                  error={error}
                  onRetry={lastFailedQuery ? () => {
                    setError(null);
                    if (isAuthenticated) submitQueryStreaming(lastFailedQuery);
                    else submitQuery(lastFailedQuery);
                  } : undefined}
                />
              )}
              {isLoading && !streamingText && <AdvisorLoading />}
              {streamingText !== null && streamingQuery && (
                <AdvisorStreamingPanel
                  query={streamingQuery}
                  text={streamingText}
                  stage={streamingStage}
                />
              )}

              {/* Conversation thread */}
              {thread.length > 0 && (
                <div className="space-y-8 mt-2">
                  {thread.map((entry, idx) => {
                    const isLast = idx === thread.length - 1;
                    return (
                      <AdvisorResponsePanel
                        key={`${entry.response.conversationId}-${idx}`}
                        response={entry.response}
                        submittedQuery={entry.query}
                        formattedTimestamp={
                          entry.response.timestamp
                            ? new Date(entry.response.timestamp).toLocaleString()
                            : null
                        }
                        confidencePercent={
                          entry.response.riskProfile.confidence
                            ? `${Math.round(entry.response.riskProfile.confidence * 100)}% confidence`
                            : null
                        }
                        onQuestionClick={isLast ? handleFollowUp : undefined}
                        onAnswersSubmit={isLast ? handleAnswersSubmit : undefined}
                        onActionCard={handleActionCard}
                        showFollowUps={isLast}
                        showActionCards={!entry.response.generatedArtifact && entry.response.mode !== 'clarification'}
                        isPaidUser={session?.user?.role === 'PRO' || session?.user?.role === 'TEAM' || session?.user?.role === 'ENTERPRISE' || session?.user?.role === 'ADMIN'}
                        isActionLoading={actionLoading}
                        exchangeNumber={idx + 1}
                        totalExchanges={thread.length}
                        detectedSectors={entry.detectedSectors}
                        detectedRegulations={entry.detectedRegulations}
                      />
                    );
                  })}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
