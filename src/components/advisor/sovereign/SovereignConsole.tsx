'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2, Radar } from 'lucide-react';
import type { useGoviSession } from '../useGoviSession';
import { WorkflowPanel } from '../WorkflowPanel';
import { DocumentPanel, type ActiveArtifact, type PanelTab } from './DocumentPanel';
import { SovereignMessage } from './SovereignMessage';
import { SovereignInput } from './SovereignInput';
import { SovereignActionsMenu } from './SovereignActionsMenu';
import { sessionCode } from './metrics';
import type { AdvisorResponse } from '@/types/advisor';

type GoviSession = ReturnType<typeof useGoviSession>;

interface SovereignConsoleProps {
  /** Shared session lifted into GoviExperience so the skin can be switched without losing state. */
  session: GoviSession;
}

const STARTER_PROMPTS = [
  'We use ChatGPT in our customer support team. What risks should we address?',
  'We\'re building an AI tool to screen CVs for hiring. What regulations apply?',
  'Our startup uses AI to generate marketing content. What governance do we need?',
  'We want to deploy an AI chatbot for financial advice. What are the risks?',
];

function isPaid(role?: string | null) {
  return role === 'PRO' || role === 'TEAM' || role === 'ENTERPRISE' || role === 'ADMIN';
}

function exportThreadLog(
  entries: { query: string; response: AdvisorResponse }[],
  code: string,
) {
  const lines = [`# Govi — AI Governance Session — ${code}`, ''];
  for (const [i, e] of entries.entries()) {
    lines.push(`## Exchange ${i + 1}`, '', `**You:** ${e.query}`, '');
    lines.push(`**Govi (${e.response.riskProfile.level} risk):**`, e.response.riskProfile.description, '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `govi-session-${code}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SovereignConsole({ session }: SovereignConsoleProps) {
  const s = session;

  const lastResponse = s.thread.length > 0 ? s.thread[s.thread.length - 1].response : null;
  const isPaidUser = isPaid(s.session?.user?.role);
  const code = useMemo(() => sessionCode(s.activeConversationId), [s.activeConversationId]);

  // ── Document panel state (Claude-artifacts-style) ──
  const [openDoc, setOpenDoc] = useState<ActiveArtifact | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('analysis');
  const autoOpenedIdRef = useRef<string | null>(null);

  // When a new artifact lands on the latest exchange (action card or workflow
  // completion), open it in the document panel — once per artifact id.
  const latestArtifact = lastResponse?.generatedArtifact ?? null;
  useEffect(() => {
    if (latestArtifact?.id && latestArtifact.id !== autoOpenedIdRef.current) {
      autoOpenedIdRef.current = latestArtifact.id;
      setOpenDoc(latestArtifact);
      setPanelTab('document');
    }
  }, [latestArtifact]);

  // While a document is being generated, surface the drafting state in the panel.
  useEffect(() => {
    if (s.actionLoading) setPanelTab('document');
  }, [s.actionLoading]);

  const openArtifact = (artifact: ActiveArtifact) => {
    setOpenDoc(artifact);
    setPanelTab('document');
  };

  const closeDocument = () => {
    setOpenDoc(null);
    setPanelTab('analysis');
  };

  const showStarters =
    s.thread.length === 0 && !s.isLoading && !s.error && s.query.length === 0 &&
    !(!s.isAuthenticated && s.guestUsed);

  return (
    <div className="sovereign-scope flex h-[calc(100vh-4rem)] w-full flex-col bg-terminal-black text-terminal-text lg:flex-row">
      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Identity now lives at the top of the left sidebar (see Sidebar.tsx). */}

        {/* Scrollable conversation body */}
        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-8">
          {/* Empty / welcome state */}
          {showStarters && (
            <div className="mx-auto max-w-2xl py-6 text-center">
              <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-xl bg-terminal-green font-mono text-xl font-bold text-terminal-black shadow-[0_0_30px_rgba(0,255,136,0.25)]">
                G
              </div>
              <h2 className="font-mono text-2xl font-bold tracking-tight text-terminal-text">
                AI Governance Advisor
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-terminal-muted">
                Describe your AI use case and get an instant governance risk
                assessment with recommendations aligned to NIST AI RMF, ISO
                42001, and the EU AI Act — grounded in the GovSecure Governance
                Library.
              </p>
              <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                {STARTER_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => s.handleStarterPrompt(p)}
                    className="glass rounded-xl p-4 text-left text-sm leading-relaxed text-terminal-muted transition-colors duration-300 hover:border-terminal-green/40 hover:text-terminal-text"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Thread */}
          {s.thread.map((entry, idx) => (
            <SovereignMessage
              key={`${entry.response.conversationId}-${idx}`}
              query={entry.query}
              response={entry.response}
              timestamp={
                entry.response.timestamp
                  ? new Date(entry.response.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null
              }
              isLast={idx === s.thread.length - 1}
              isPaidUser={isPaidUser}
              isActionLoading={s.actionLoading}
              isLoading={s.isLoading}
              openArtifactId={openDoc?.id ?? null}
              onOpenArtifact={openArtifact}
              onAnswersSubmit={idx === s.thread.length - 1 ? s.handleAnswersSubmit : undefined}
              onAction={s.handleActionCard}
            />
          ))}

          {/* Streaming / computing state */}
          {s.isLoading && s.streamingQuery && (
            <div className="space-y-4">
              <div className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-xl rounded-tr-md bg-terminal-gray/30 px-5 py-4">
                  <p className="text-[15px] leading-relaxed text-terminal-text">{s.streamingQuery}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-terminal-green font-mono text-xs font-bold text-terminal-black">
                  G
                </span>
                <span className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
                  Govi
                  <span className="flex items-center gap-1 text-terminal-green">
                    <Radar className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '2s' }} />
                    {s.streamingStage === 'reconnecting'
                      ? 'Reconnecting…'
                      : s.streamingStage === 'streaming'
                      ? 'Composing…'
                      : 'Computing…'}
                  </span>
                </span>
              </div>
              <div className="glass rounded-xl p-6">
                <div className="space-y-3">
                  <div className="h-3 w-3/4 animate-pulse rounded-full bg-terminal-gray/40" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-terminal-gray/40" />
                  <div className="h-3 w-5/6 animate-pulse rounded-full bg-terminal-gray/40" />
                </div>
              </div>
            </div>
          )}

          {/* Non-streaming loading (guests) */}
          {s.isLoading && !s.streamingQuery && (
            <div className="flex items-center gap-2 text-sm text-terminal-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your query…
            </div>
          )}

          {/* Active workflow */}
          {s.activeWorkflowSession && (
            <div className="glass rounded-xl p-1">
              <WorkflowPanel
                sessionId={s.activeWorkflowSession.sessionId}
                onCancel={() => s.setActiveWorkflowSession(null)}
                onComplete={(result) => {
                  s.setActiveWorkflowSession(null);
                  s.setThread((prev) => {
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

          {/* Error */}
          {s.error && (
            <div className="rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-4 py-3">
              <p className="text-sm text-terminal-red">{s.error}</p>
              {s.lastFailedQuery && (
                <button
                  onClick={() => {
                    s.setError(null);
                    if (s.isAuthenticated) s.submitQueryStreaming(s.lastFailedQuery!);
                    else s.submitQuery(s.lastFailedQuery!);
                  }}
                  className="mt-2 text-sm font-medium text-terminal-red underline-offset-2 hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Guest gate */}
          {!s.isAuthenticated && s.guestUsed && (
            <div className="glass rounded-xl py-10 text-center">
              <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-terminal-green" />
              <p className="text-[15px] font-semibold text-terminal-text">Free prompt used</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-terminal-muted">
                Sign in to continue using Govi and save your conversation history.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link href="/signin" className="btn-secondary text-sm py-2">
                  Sign In
                </Link>
                <Link href="/signup" className="btn-primary text-sm py-2">
                  Sign Up
                </Link>
              </div>
            </div>
          )}

          <div ref={s.bottomRef} />
        </div>

        {/* Input dock */}
        {!(!s.isAuthenticated && s.guestUsed) && (
          <div
            ref={s.inputAreaRef}
            className="border-t border-terminal-border bg-terminal-black/95 px-6 py-4 backdrop-blur"
          >
            <SovereignInput
              query={s.query}
              isLoading={s.isLoading}
              followUpPrompt={s.followUpPrompt}
              isPaidUser={isPaidUser}
              onChange={s.setQuery}
              onSubmit={s.handleSubmit}
              actionsSlot={
                <SovereignActionsMenu
                  isAuthenticated={s.isAuthenticated}
                  conversations={s.conversations}
                  activeConversationId={s.activeConversationId}
                  exportDisabled={s.thread.length === 0}
                  onNewConversation={s.handleNewConversation}
                  onSelectConversation={s.handleSelectConversation}
                  onDeleteConversation={s.handleDeleteConversation}
                  onExport={() => exportThreadLog(s.thread, code)}
                />
              }
            />
          </div>
        )}
      </div>

      {/* ── Right panel: generated documents + governance analysis ── */}
      <DocumentPanel
        artifact={openDoc}
        tab={panelTab}
        onTabChange={setPanelTab}
        onClose={closeDocument}
        response={lastResponse}
        isPaidUser={isPaidUser}
        analyzing={s.isLoading}
        generating={s.actionLoading}
      />
    </div>
  );
}
