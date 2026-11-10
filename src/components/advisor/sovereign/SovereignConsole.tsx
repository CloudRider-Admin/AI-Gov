'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2, PanelLeftOpen, PanelRightOpen, Download, SquarePen } from 'lucide-react';
import type { useGoviSession } from '../useGoviSession';
import { WorkflowPanel } from '../WorkflowPanel';
import { DocumentPane, InsightsPanel, type ActiveArtifact } from './DocumentPanel';
import { GoviChatList } from './GoviChatList';
import { SovereignMessage } from './SovereignMessage';
import { SovereignInput } from './SovereignInput';
import { SovereignActionsMenu } from './SovereignActionsMenu';
import { sessionCode } from './metrics';
import type { AdvisorResponse } from '@/types/advisor';

type GoviSession = ReturnType<typeof useGoviSession>;

interface SovereignConsoleProps {
  /** Shared session lifted into GoviExperience. */
  session: GoviSession;
}

const STARTER_PROMPTS = [
  'We use ChatGPT in our customer support team. What risks should we address?',
  "We're building an AI tool to screen CVs for hiring. What regulations apply?",
  'Our startup uses AI to generate marketing content. What governance do we need?',
  'We want to deploy an AI chatbot for financial advice. What are the risks?',
];

const CHAT_LIST_KEY = 'govi:chat-list-hidden';
const INSIGHTS_KEY = 'govi:insights-hidden';

function isPaid(role?: string | null) {
  return role === 'PRO' || role === 'TEAM' || role === 'ENTERPRISE' || role === 'ADMIN';
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function exportThreadLog(entries: { query: string; response: AdvisorResponse }[], code: string) {
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

/**
 * The Govi chat page: its own conversation column, a centered chat, and the
 * document pane. Opening (or generating) a document splits the screen like
 * Claude's artifacts / Muse's documents — the chat narrows and the document
 * takes the rest; it can be expanded to full width or closed.
 */
export function SovereignConsole({ session }: SovereignConsoleProps) {
  const s = session;

  const lastResponse = s.thread.length > 0 ? s.thread[s.thread.length - 1].response : null;
  const isPaidUser = isPaid(s.session?.user?.role);
  const code = useMemo(() => sessionCode(s.activeConversationId), [s.activeConversationId]);
  const firstName = s.session?.user?.name?.split(' ')[0] ?? null;
  // Client-only so the greeting follows the user's clock, not the server's.
  const [hello, setHello] = useState<string | null>(null);
  useEffect(() => setHello(greeting()), []);

  // ── Panels ──
  const [chatListHidden, setChatListHidden] = useState(false);
  const [insightsHidden, setInsightsHidden] = useState(false);
  useEffect(() => {
    setChatListHidden(readFlag(CHAT_LIST_KEY));
    setInsightsHidden(readFlag(INSIGHTS_KEY));
  }, []);
  const toggleChatList = (hidden: boolean) => {
    setChatListHidden(hidden);
    writeFlag(CHAT_LIST_KEY, hidden);
  };
  const toggleInsights = (hidden: boolean) => {
    setInsightsHidden(hidden);
    writeFlag(INSIGHTS_KEY, hidden);
  };

  // ── Document pane (Claude-artifacts style) ──
  const [openDoc, setOpenDoc] = useState<ActiveArtifact | null>(null);
  const [docExpanded, setDocExpanded] = useState(false);
  const [draftingVisible, setDraftingVisible] = useState(false);
  const autoOpenedIdRef = useRef<string | null>(null);

  // When a new artifact lands on the latest exchange, open it — once per id.
  const latestArtifact = lastResponse?.generatedArtifact ?? null;
  useEffect(() => {
    if (latestArtifact?.id && latestArtifact.id !== autoOpenedIdRef.current) {
      autoOpenedIdRef.current = latestArtifact.id;
      setOpenDoc(latestArtifact);
      setDraftingVisible(false);
    }
  }, [latestArtifact]);

  // While a document is being generated, show the drafting state in the pane.
  useEffect(() => {
    if (s.actionLoading) setDraftingVisible(true);
    else setDraftingVisible(false);
  }, [s.actionLoading]);

  const docPaneOpen = openDoc != null || draftingVisible;

  const pendingDocRef = useRef<string | null>(null);

  // On first load, open the document named in ?doc= (fetched from the library).
  useEffect(() => {
    const docId = new URL(window.location.href).searchParams.get('doc');
    if (!docId) return;
    pendingDocRef.current = docId;
    let cancelled = false;
    fetch(`/api/artifacts/${encodeURIComponent(docId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a: { id: string; type: string; title: string; riskTier: string | null; content: string; markdownExport: string } | null) => {
        if (!a || cancelled) return;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(a.content) as Record<string, unknown>;
        } catch {
          /* markdown-only artifact */
        }
        autoOpenedIdRef.current = a.id;
        setOpenDoc({
          id: a.id,
          type: a.type,
          data: {
            ...parsed,
            title: (parsed.title as string) ?? a.title,
            riskTier: (parsed.riskTier as string) ?? a.riskTier ?? undefined,
            markdownExport: a.markdownExport,
          },
        });
      })
      .catch(() => {})
      .finally(() => {
        pendingDocRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the open document in the URL (?doc=<id>) so it can be linked to and
  // survives a reload — like Claude's ?artifact=. Uses the history API so it
  // doesn't trigger a server round-trip.
  useEffect(() => {
    const url = new URL(window.location.href);
    const current = url.searchParams.get('doc');
    const next = openDoc?.id ?? null;
    if (current === next) return;
    // Don't strip ?doc= while the linked document is still loading.
    if (!next && pendingDocRef.current) return;
    if (next) url.searchParams.set('doc', next);
    else url.searchParams.delete('doc');
    window.history.replaceState(window.history.state, '', url.toString());
  }, [openDoc?.id]);

  const openArtifact = (artifact: ActiveArtifact) => {
    setOpenDoc(artifact);
  };
  const closeDocument = () => {
    setOpenDoc(null);
    setDraftingVisible(false);
    setDocExpanded(false);
  };

  const startNew = () => {
    closeDocument();
    s.handleNewConversation();
  };
  const selectConversation = (id: string) => {
    closeDocument();
    s.handleSelectConversation(id);
  };

  const isEmpty = s.thread.length === 0 && !s.isLoading && !s.activeWorkflowSession;
  const guestBlocked = !s.isAuthenticated && s.guestUsed;
  const activeTitle =
    s.conversations.find((c) => c.id === s.activeConversationId)?.title ??
    (s.thread[0]?.query ? s.thread[0].query.slice(0, 80) : 'New chat');

  const showChatList = s.isAuthenticated && !chatListHidden && !docPaneOpen;
  const showInsights = !docPaneOpen && !insightsHidden && s.thread.length > 0;

  const actionsMenu = (
    <SovereignActionsMenu
      isAuthenticated={s.isAuthenticated}
      conversations={s.conversations}
      activeConversationId={s.activeConversationId}
      exportDisabled={s.thread.length === 0}
      onNewConversation={startNew}
      onSelectConversation={selectConversation}
      onDeleteConversation={s.handleDeleteConversation}
      onExport={() => exportThreadLog(s.thread, code)}
    />
  );

  const iconBtn =
    'grid h-8 w-8 place-items-center rounded-lg text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text';

  return (
    <div className="flex h-[calc(100vh-var(--header-h))] w-full bg-terminal-black text-terminal-text">
      {/* ── Govi chat list ── */}
      {showChatList && (
        <div className="hidden lg:flex">
          <GoviChatList
            conversations={s.conversations}
            activeConversationId={s.activeConversationId}
            onNew={startNew}
            onSelect={selectConversation}
            onDelete={s.handleDeleteConversation}
            onHide={() => toggleChatList(true)}
          />
        </div>
      )}

      {/* ── Chat column ── */}
      <div
        className={`min-w-0 flex-col ${
          docPaneOpen
            ? docExpanded
              ? 'hidden'
              : 'hidden w-[clamp(340px,34%,560px)] flex-none lg:flex'
            : 'flex flex-1'
        }`}
      >
        {/* Top bar */}
        <div className="flex h-12 flex-none items-center gap-1 px-3">
          {s.isAuthenticated && (!showChatList || docPaneOpen) && (
            <button
              type="button"
              onClick={() => {
                if (docPaneOpen) closeDocument();
                toggleChatList(false);
              }}
              aria-label="Show chats"
              title="Show chats"
              className={`hidden lg:grid ${iconBtn}`}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-terminal-text">
            {isEmpty ? '' : activeTitle}
          </h1>
          {s.isAuthenticated && !isEmpty && (
            <button type="button" onClick={startNew} aria-label="New chat" title="New chat" className={iconBtn}>
              <SquarePen className="h-4 w-4" />
            </button>
          )}
          {s.thread.length > 0 && (
            <button
              type="button"
              onClick={() => exportThreadLog(s.thread, code)}
              aria-label="Export conversation"
              title="Export conversation (.md)"
              className={iconBtn}
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {!docPaneOpen && s.thread.length > 0 && insightsHidden && (
            <button
              type="button"
              onClick={() => toggleInsights(false)}
              aria-label="Show insights"
              title="Show insights"
              className={`hidden xl:grid ${iconBtn}`}
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          )}
        </div>

        {isEmpty && !guestBlocked ? (
          /* ── Empty state: greeting + hero composer ── */
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-16">
            <div className="w-full max-w-[720px]">
              <div className="mb-7 flex items-center justify-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-terminal-green text-base font-semibold text-[var(--color-bg-secondary)]">
                  G
                </span>
                <h2 className="font-serif text-[34px] font-normal leading-tight tracking-tight text-terminal-text">
                  {hello ?? 'Welcome back'}
                  {firstName ? `, ${firstName}` : ''}
                </h2>
              </div>
              <div ref={s.inputAreaRef}>
                <SovereignInput
                  variant="hero"
                  query={s.query}
                  isLoading={s.isLoading}
                  followUpPrompt={s.followUpPrompt}
                  isPaidUser={isPaidUser}
                  onChange={s.setQuery}
                  onSubmit={s.handleSubmit}
                  placeholder="What are we governing today? Describe an AI use case or ask a question…"
                  actionsSlot={actionsMenu}
                />
              </div>
              {s.query.length === 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => s.handleStarterPrompt(p)}
                      className="rounded-xl border border-terminal-border px-3.5 py-2.5 text-left text-sm leading-snug text-terminal-muted transition-colors hover:bg-terminal-dark hover:text-terminal-text"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              {s.error && (
                <p className="mt-4 text-center text-sm text-terminal-red">{s.error}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ── Conversation ── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className={`mx-auto space-y-10 px-5 pb-10 pt-4 ${docPaneOpen ? 'max-w-none' : 'max-w-3xl'}`}>
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
                  <div className="space-y-5">
                    <div className="flex flex-col items-end">
                      <div className="max-w-[85%] rounded-2xl bg-terminal-gray px-4 py-2.5">
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-terminal-text">
                          {s.streamingQuery}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-terminal-green text-xs font-semibold text-[var(--color-bg-secondary)]">
                        G
                      </span>
                      <span className="text-sm font-medium text-terminal-text">Govi</span>
                      <span className="flex items-center gap-1.5 text-sm text-terminal-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {s.streamingStage === 'reconnecting'
                          ? 'Reconnecting…'
                          : s.streamingStage === 'streaming'
                          ? 'Writing…'
                          : 'Thinking…'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 w-3/4 animate-pulse rounded-full bg-terminal-gray" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-terminal-gray" />
                      <div className="h-3 w-5/6 animate-pulse rounded-full bg-terminal-gray" />
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
                  <div className="surface rounded-2xl p-1">
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
                {guestBlocked && (
                  <div className="surface rounded-2xl py-10 text-center">
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
            </div>

            {/* ── Docked composer ── */}
            {!guestBlocked && (
              <div ref={s.inputAreaRef} className="flex-none px-5 pb-4 pt-1">
                <div className={`mx-auto ${docPaneOpen ? 'max-w-none' : 'max-w-3xl'}`}>
                  <SovereignInput
                    query={s.query}
                    isLoading={s.isLoading}
                    followUpPrompt={s.followUpPrompt}
                    isPaidUser={isPaidUser}
                    onChange={s.setQuery}
                    onSubmit={s.handleSubmit}
                    placeholder="Reply to Govi…"
                    actionsSlot={actionsMenu}
                  />
                  <p className="mt-2 text-center text-xs text-terminal-muted">
                    Govi can make mistakes. Verify regulatory guidance before relying on it.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Document pane ── */}
      {docPaneOpen && (
        <DocumentPane
          artifact={openDoc}
          generating={s.actionLoading}
          expanded={docExpanded}
          onToggleExpand={() => setDocExpanded((v) => !v)}
          onClose={closeDocument}
        />
      )}

      {/* ── Insights ── */}
      {showInsights && (
        <InsightsPanel
          response={lastResponse}
          isPaidUser={isPaidUser}
          analyzing={s.isLoading}
          onClose={() => toggleInsights(true)}
        />
      )}
    </div>
  );
}
