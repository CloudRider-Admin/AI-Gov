'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  History,
  BookOpen,
  ShieldCheck,
  Trash2,
  Loader2,
  Radar,
} from 'lucide-react';
import { useGoviSession } from '../useGoviSession';
import { WorkflowPanel } from '../WorkflowPanel';
import { AuditIntelligencePanel } from './AuditIntelligencePanel';
import { SovereignMessage } from './SovereignMessage';
import { SovereignInput } from './SovereignInput';
import { sessionCode } from './metrics';
import type { AdvisorResponse } from '@/types/advisor';

interface SovereignConsoleProps {
  initialQuery?: string;
  initialConversationId?: string;
}

const STARTER_PROMPTS = [
  'Analyze our data retention policy against the new EU AI Act requirements.',
  'We use AI to screen CVs for hiring. Which regulations classify this as high-risk?',
  'Draft a DPIA for a customer-facing chatbot handling personal data.',
  'Assess third-party risk for a SaaS vendor embedding an LLM in our workflow.',
];

function isPaid(role?: string | null) {
  return role === 'PRO' || role === 'TEAM' || role === 'ENTERPRISE' || role === 'ADMIN';
}

function exportThreadLog(
  entries: { query: string; response: AdvisorResponse }[],
  code: string,
) {
  const lines = [`# Compliance Analysis Session — ${code}`, ''];
  for (const [i, e] of entries.entries()) {
    lines.push(`## Exchange ${i + 1}`, '', `**Auditor:** ${e.query}`, '');
    lines.push(`**Govi (${e.response.riskProfile.level} risk):**`, e.response.riskProfile.description, '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compliance-session-${code}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SovereignConsole({ initialQuery, initialConversationId }: SovereignConsoleProps) {
  const s = useGoviSession({ initialQuery, initialConversationId });
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const lastResponse = s.thread.length > 0 ? s.thread[s.thread.length - 1].response : null;
  const isPaidUser = isPaid(s.session?.user?.role);
  const code = useMemo(() => sessionCode(s.activeConversationId), [s.activeConversationId]);

  const showStarters =
    s.thread.length === 0 && !s.isLoading && !s.error && s.query.length === 0 &&
    !(!s.isAuthenticated && s.guestUsed);

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)] lg:flex-row">
        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="sticky top-16 z-10 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900">
                  Compliance Analysis Session
                </h1>
                <p className="text-[11px] font-mono uppercase tracking-wide text-slate-400">
                  ID: {code}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {s.isAuthenticated && (
                <div className="relative">
                  <button
                    onClick={() => setSessionsOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sessions</span>
                  </button>
                  {sessionsOpen && (
                    <div className="absolute right-0 top-full z-20 mt-2 max-h-96 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <button
                        onClick={() => {
                          s.handleNewConversation();
                          setSessionsOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> New session
                      </button>
                      {s.conversations.length > 0 && (
                        <div className="my-1 border-t border-slate-100" />
                      )}
                      {s.conversations.map((c) => (
                        <div
                          key={c.id}
                          className={`group flex items-center gap-1 rounded-lg px-1 ${
                            s.activeConversationId === c.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            onClick={() => {
                              s.handleSelectConversation(c.id);
                              setSessionsOpen(false);
                            }}
                            className="min-w-0 flex-1 truncate px-2 py-2 text-left text-[13px] text-slate-700"
                          >
                            {c.title}
                          </button>
                          <button
                            onClick={() => s.handleDeleteConversation(c.id)}
                            aria-label="Delete session"
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Link
                href="/govi/library"
                className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 sm:flex"
              >
                <BookOpen className="h-3.5 w-3.5" /> Library
              </Link>
              <button
                onClick={() => exportThreadLog(s.thread, code)}
                disabled={s.thread.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileText className="h-3.5 w-3.5" /> Export Log
              </button>
            </div>
          </div>

          {/* Scrollable conversation body */}
          <div className="flex-1 space-y-8 px-6 py-8">
            {/* Empty / welcome state */}
            {showStarters && (
              <div className="mx-auto max-w-2xl py-6 text-center">
                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-xl font-mono font-bold text-white shadow-lg shadow-emerald-600/20">
                  G
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Sovereign Audit Console
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-slate-500">
                  Interrogate governance frameworks, generate defensible artifacts
                  and track compliance posture in real time — grounded in the
                  GovSecure Governance Library.
                </p>
                <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => s.handleStarterPrompt(p)}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left text-[13.5px] leading-relaxed text-slate-600 transition-all hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-slate-800"
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
                onFollowUp={idx === s.thread.length - 1 ? s.handleFollowUp : undefined}
                onAction={s.handleActionCard}
              />
            ))}

            {/* Streaming / computing state */}
            {s.isLoading && s.streamingQuery && (
              <div className="space-y-4">
                <div className="flex flex-col items-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-slate-100 px-5 py-4">
                    <p className="text-[15px] leading-relaxed text-slate-800">{s.streamingQuery}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-xs font-mono font-bold text-white">
                    G
                  </span>
                  <span className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Govi Sovereign Assistant
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Radar className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '2s' }} />
                      {s.streamingStage === 'reconnecting'
                        ? 'Reconnecting…'
                        : s.streamingStage === 'streaming'
                        ? 'Composing…'
                        : 'Computing…'}
                    </span>
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="space-y-3">
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>
              </div>
            )}

            {/* Non-streaming loading (guests) */}
            {s.isLoading && !s.streamingQuery && (
              <div className="flex items-center gap-2 text-[13px] text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your query…
              </div>
            )}

            {/* Active workflow */}
            {s.activeWorkflowSession && (
              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-1">
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
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[13px] text-red-700">{s.error}</p>
                {s.lastFailedQuery && (
                  <button
                    onClick={() => {
                      s.setError(null);
                      if (s.isAuthenticated) s.submitQueryStreaming(s.lastFailedQuery!);
                      else s.submitQuery(s.lastFailedQuery!);
                    }}
                    className="mt-2 text-[13px] font-medium text-red-600 hover:underline"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* Guest gate */}
            {!s.isAuthenticated && s.guestUsed && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 py-10 text-center">
                <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                <p className="text-[15px] font-semibold text-slate-800">Free analysis used</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">
                  Sign in to continue using the Sovereign Console and save your
                  audit sessions.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <Link
                    href="/signin"
                    className="rounded-lg border border-slate-300 px-5 py-2 text-[13px] font-medium text-slate-700 hover:bg-white"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-emerald-500 px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-400"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            )}

            <div ref={s.bottomRef} />
          </div>

          {/* Input dock */}
          {!(!s.isAuthenticated && s.guestUsed) && (
            <div ref={s.inputAreaRef} className="sticky bottom-0 border-t border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur">
              <SovereignInput
                query={s.query}
                isLoading={s.isLoading}
                followUpPrompt={s.followUpPrompt}
                onChange={s.setQuery}
                onSubmit={s.handleSubmit}
              />
            </div>
          )}
        </div>

        {/* ── Intelligence panel ── */}
        <AuditIntelligencePanel
          response={lastResponse}
          isPaidUser={isPaidUser}
          analyzing={s.isLoading}
        />
      </div>
    </div>
  );
}
