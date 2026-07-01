'use client';

import Link from 'next/link';
import { Sparkles, Terminal } from 'lucide-react';
import { advisorContent } from '@/data/content';
import { AdvisorInput } from './AdvisorInput';
import { AdvisorLoading } from './AdvisorLoading';
import { AdvisorError } from './AdvisorError';
import { AdvisorResponsePanel } from './AdvisorResponsePanel';
import { AdvisorStreamingPanel } from './AdvisorStreamingPanel';
import { ConversationHistory } from './ConversationHistory';
import { TokenBudgetIndicator } from './TokenBudgetIndicator';
import { WorkflowPanel } from './WorkflowPanel';
import { useGoviSession } from './useGoviSession';

const STARTER_PROMPTS = [
  'We use ChatGPT in our customer support team. What risks should we address?',
  'We\'re building an AI tool to screen CVs for hiring. What regulations apply?',
  'Our startup uses AI to generate marketing content. What governance do we need?',
  'We want to deploy an AI chatbot for financial advice. What are the risks?',
];

interface AdvisorProps {
  showHeader?: boolean;
  initialQuery?: string;
  initialConversationId?: string;
}

export function Advisor({ showHeader = true, initialQuery, initialConversationId }: AdvisorProps) {
  const {
    session,
    isAuthenticated,
    query,
    setQuery,
    isLoading,
    thread,
    setThread,
    error,
    setError,
    activeConversationId,
    conversations,
    sidebarOpen,
    setSidebarOpen,
    guestUsed,
    actionLoading,
    lastFailedQuery,
    budgetRefreshKey,
    streamingText,
    streamingStage,
    streamingQuery,
    followUpPrompt,
    activeWorkflowSession,
    setActiveWorkflowSession,
    bottomRef,
    inputAreaRef,
    submitQuery,
    submitQueryStreaming,
    handleSubmit,
    handleFollowUp,
    handleAnswersSubmit,
    handleStarterPrompt,
    handleReset,
    handleActionCard,
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
  } = useGoviSession({ initialQuery, initialConversationId });

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
                <div className="mb-6 space-y-4">
                  <div>
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

                  {/* GovSecure discoverability hint */}
                  <div className="rounded-lg border border-terminal-green/20 bg-terminal-green/5 p-3 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-terminal-green shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1 min-w-0 text-xs font-sans text-terminal-text leading-relaxed">
                      Govi grounds answers in the{' '}
                      <Link href="/govi/library" className="font-mono text-terminal-green hover:underline">
                        GovSecure Governance Library
                      </Link>
                      . Ask about a vendor or third-party AI tool to launch the
                      multi-turn TPRM workflow.
                    </div>
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

              {/* Active multi-turn workflow */}
              {activeWorkflowSession && (
                <div className="mt-4">
                  <WorkflowPanel
                    sessionId={activeWorkflowSession.sessionId}
                    onCancel={() => setActiveWorkflowSession(null)}
                    onComplete={(result) => {
                      setActiveWorkflowSession(null);
                      setThread((prev) => {
                        if (prev.length === 0) return prev;
                        const updated = [...prev];
                        const lastIdx = updated.length - 1;
                        updated[lastIdx] = {
                          ...updated[lastIdx],
                          response: {
                            ...updated[lastIdx].response,
                            generatedArtifact: {
                              type: 'document',
                              id: result.artifactId,
                              data: result.document,
                            },
                          },
                        };
                        return updated;
                      });
                    }}
                  />
                </div>
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
