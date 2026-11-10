'use client';

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
import { ClarificationCard } from './ClarificationCard';
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

function PolicyCard({ policy, index }: { policy: PolicyRecommendation; index: number }) {
  const Icon = POLICY_ICONS[index % POLICY_ICONS.length];
  const isWarn = policy.priority === 'high';
  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-dark p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isWarn ? 'text-terminal-amber' : 'text-terminal-green'}`} />
        <span className="text-xs font-medium text-terminal-text">
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
        <div
          className="max-w-[85%] rounded-2xl bg-terminal-gray px-4 py-2.5"
          title={timestamp ? `Sent ${timestamp}` : undefined}
        >
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-terminal-text">{query}</p>
        </div>
      </div>

      {/* Assistant identity */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-terminal-green text-xs font-semibold text-[var(--color-bg-secondary)]">
          G
        </span>
        <span className="text-sm font-medium text-terminal-text">Govi</span>
        {!isClarification && (
          <span className={`rounded-full bg-terminal-gray px-2 py-0.5 text-xs font-medium ${risk.text}`}>
            {risk.label} risk
          </span>
        )}
      </div>

      {/* Assistant card */}
      <div>
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
          <ClarificationCard
            questions={followUps}
            choices={response.followUpChoices}
            disabled={isLoading}
            onSubmit={onAnswersSubmit}
          />
        )}

        {/* Action toolbar */}
        {!isClarification && !artifact && cards.length > 0 && (
          <div className="mt-6 border-t border-terminal-border pt-4">
            <div className="mb-2.5 flex items-center gap-2">
              <GitCompare className="h-3.5 w-3.5 text-terminal-muted" />
              <span className="text-xs font-medium text-terminal-muted">
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-terminal-border bg-terminal-gray/20 px-3.5 py-2 text-xs font-medium text-terminal-text transition-colors duration-300 hover:border-terminal-green/50 hover:text-terminal-green disabled:cursor-not-allowed disabled:opacity-50"
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
                <a href="/contact" className="font-medium text-terminal-green hover:underline">
                  Contact us →
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
