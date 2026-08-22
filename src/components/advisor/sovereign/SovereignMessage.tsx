'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Archive,
  AlertTriangle,
  ShieldCheck,
  Lock,
  GitCompare,
  FileSearch,
  Loader2,
} from 'lucide-react';
import type { AdvisorResponse, PolicyRecommendation } from '@/types/advisor';
import { buildCards, type ActionCardAction } from '../ActionCardsPanel';
import { ArtifactCard } from './ArtifactCard';
import type { ActiveArtifact } from './DocumentPanel';
import { RISK_VISUALS } from './metrics';

interface SovereignMessageProps {
  query: string;
  response: AdvisorResponse;
  timestamp: string | null;
  isLast: boolean;
  isPaidUser: boolean;
  isActionLoading: boolean;
  /** True while any query is in flight — disables the clarification form. */
  isLoading: boolean;
  /** Id of the artifact currently open in the document panel, if any. */
  openArtifactId: string | null;
  onOpenArtifact: (artifact: ActiveArtifact) => void;
  /** Submit answers to some or all of Govi's clarifying questions at once. */
  onAnswersSubmit?: (answers: { question: string; answer: string }[]) => void;
  onAction: (action: ActionCardAction) => void;
}

const POLICY_ICONS = [Archive, AlertTriangle, ShieldCheck, FileSearch];

/**
 * Clarification answer form: one input per question so the user can answer
 * every clarifying question in a single reply (any subset is fine — empty
 * answers are simply omitted).
 */
function ClarificationForm({
  questions,
  disabled,
  onSubmit,
}: {
  questions: string[];
  disabled: boolean;
  onSubmit: (answers: { question: string; answer: string }[]) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
  const answeredCount = answers.filter((a) => a.trim().length > 0).length;

  const setAnswer = (index: number, value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const submit = () => {
    const filled = questions
      .map((question, i) => ({ question, answer: answers[i].trim() }))
      .filter((a) => a.answer.length > 0);
    if (filled.length > 0) onSubmit(filled);
  };

  return (
    <div className="mt-5">
      <p className="mb-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-terminal-cyan">
        Govi needs a little more context — answer any or all
      </p>
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={i} className="rounded-xl border border-terminal-border bg-terminal-gray/20 p-3">
            <label className="flex gap-2 text-sm leading-relaxed text-terminal-text">
              <span className="mt-0.5 font-mono text-xs text-terminal-cyan">
                {String(i + 1).padStart(2, '0')}
              </span>
              {q}
            </label>
            <textarea
              rows={2}
              value={answers[i]}
              onChange={(e) => setAnswer(i, e.target.value)}
              disabled={disabled}
              placeholder="Your answer…"
              className="mt-2 w-full resize-none rounded-md border border-terminal-border bg-terminal-gray/40 px-3 py-2 text-sm text-terminal-text outline-none transition-colors duration-300 placeholder:text-terminal-muted focus:border-terminal-green/50 disabled:opacity-50"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-terminal-muted">
          Answer what you can — or reply free-form in the composer below.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || answeredCount === 0}
          className="btn-primary text-sm py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send answers
          {answeredCount > 0 ? ` (${answeredCount}/${questions.length})` : ''}
        </button>
      </div>
    </div>
  );
}

function PolicyCard({ policy, index }: { policy: PolicyRecommendation; index: number }) {
  const Icon = POLICY_ICONS[index % POLICY_ICONS.length];
  const isWarn = policy.priority === 'high';
  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-gray/20 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isWarn ? 'text-terminal-amber' : 'text-terminal-green'}`} />
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terminal-text">
          {policy.title}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-terminal-muted">{policy.description}</p>
    </div>
  );
}

export function SovereignMessage({
  query,
  response,
  timestamp,
  isLast,
  isPaidUser,
  isActionLoading,
  isLoading,
  openArtifactId,
  onOpenArtifact,
  onAnswersSubmit,
  onAction,
}: SovereignMessageProps) {
  const isClarification = response.mode === 'clarification';
  const risk = RISK_VISUALS[response.riskProfile.level];
  const policies = (response.suggestedPolicies ?? []).slice(0, 4);
  const followUps = response.followUpQuestions ?? [];
  const cards = buildCards(query, response).filter((c) => c.show(response)).slice(0, 4);
  const artifact = response.generatedArtifact;

  return (
    <div className="space-y-5">
      {/* User message */}
      <div className="flex flex-col items-end">
        <p className="mb-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
          You{timestamp ? ` · ${timestamp}` : ''}
        </p>
        <div className="max-w-[85%] rounded-xl rounded-tr-md bg-terminal-gray/30 px-5 py-4">
          <p className="text-[15px] leading-relaxed text-terminal-text">{query}</p>
        </div>
      </div>

      {/* Assistant identity */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-terminal-green font-mono text-xs font-bold text-terminal-black">
          G
        </span>
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
          Govi
          {!isClarification && (
            <span className={`ml-2 ${risk.text}`}>· {risk.label} Risk</span>
          )}
        </span>
      </div>

      {/* Assistant card */}
      <div className="glass rounded-xl p-6">
        {/* Warnings */}
        {response.warnings && response.warnings.length > 0 && (
          <div className="mb-4 rounded-md border border-terminal-amber/40 bg-terminal-amber/10 px-3 py-2">
            {response.warnings.map((w, i) => (
              <p key={i} className="text-xs leading-relaxed text-terminal-amber">
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Narrative */}
        <div className="sovereign-prose text-[15px] leading-relaxed text-terminal-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {response.riskProfile.description}
          </ReactMarkdown>
        </div>

        {/* Reasoning bullets */}
        {response.riskProfile.reasoning?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {response.riskProfile.reasoning.slice(0, 4).map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-terminal-muted">
                <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${risk.fill}`} />
                {r}
              </li>
            ))}
          </ul>
        )}

        {/* Policy sub-cards */}
        {policies.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {policies.map((p, i) => (
              <PolicyCard key={`${p.title}-${i}`} policy={p} index={i} />
            ))}
          </div>
        )}

        {/* Generated document — opens in the right-hand panel */}
        {artifact && (
          <div className="mt-5">
            <ArtifactCard
              artifact={artifact}
              onOpen={onOpenArtifact}
              isOpen={openArtifactId === artifact.id}
            />
          </div>
        )}

        {/* Clarification: answer all questions in one reply */}
        {isClarification && isLast && followUps.length > 0 && onAnswersSubmit && (
          <ClarificationForm
            questions={followUps}
            disabled={isLoading}
            onSubmit={onAnswersSubmit}
          />
        )}

        {/* Action toolbar */}
        {!isClarification && !artifact && cards.length > 0 && (
          <div className="mt-6 border-t border-terminal-border pt-4">
            <div className="mb-2.5 flex items-center gap-2">
              <GitCompare className="h-3.5 w-3.5 text-terminal-muted" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
                Recommended actions
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  disabled={isActionLoading || !isPaidUser}
                  onClick={() => onAction(card.action)}
                  title={card.description}
                  className="inline-flex items-center gap-1.5 rounded-full border border-terminal-border bg-terminal-gray/20 px-3.5 py-2 font-mono text-xs font-medium text-terminal-text transition-colors duration-300 hover:border-terminal-green/50 hover:text-terminal-green disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-terminal-green">{card.icon}</span>
                  {card.label}
                  {!isPaidUser && <Lock className="h-3 w-3 text-terminal-muted" />}
                </button>
              ))}
              {isActionLoading && (
                <span className="inline-flex items-center gap-1.5 px-2 text-sm text-terminal-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
                </span>
              )}
            </div>
            {!isPaidUser && (
              <p className="mt-2.5 text-xs text-terminal-muted">
                Document generation requires a Pro plan.{' '}
                <a href="/pricing" className="font-medium text-terminal-green hover:underline">
                  Upgrade →
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
