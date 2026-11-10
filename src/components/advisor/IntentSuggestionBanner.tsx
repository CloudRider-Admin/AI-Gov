'use client';

import { useState } from 'react';
import { ClipboardCheck, FileText, BookOpen, X, Sparkles } from 'lucide-react';
import type { AdvisorResponse } from '@/types/advisor';
import type { ActionCardAction } from './ActionCardsPanel';

interface IntentSuggestionBannerProps {
  suggestion: NonNullable<AdvisorResponse['intentSuggestion']>;
  useCaseDescription: string;
  isPaidUser?: boolean;
  onAction?: (action: ActionCardAction) => void;
}

/**
 * Inline CTA shown above conversational answers when the classifier
 * detected a use case worth upgrading to a structured flow (intake /
 * document / playbook) but didn't have explicit user authorization.
 *
 * The user has two choices:
 *  - "Run …" → triggers the corresponding orchestrator via the same
 *    `onActionCard` pathway the bottom action cards use.
 *  - "Keep chatting" → dismisses the banner for this exchange only.
 */
export function IntentSuggestionBanner({
  suggestion,
  useCaseDescription,
  isPaidUser = false,
  onAction,
}: IntentSuggestionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  if (!onAction) return null;

  const { Icon, label } = (() => {
    switch (suggestion.type) {
      case 'intake':
        return { Icon: ClipboardCheck, label: 'Run structured assessment' };
      case 'document':
        return { Icon: FileText, label: 'Generate document' };
      case 'playbook':
        return { Icon: BookOpen, label: 'Build playbook' };
    }
  })();

  const handleCommit = () => {
    if (!isPaidUser) return;
    if (suggestion.type === 'intake') {
      onAction({ type: 'intake', useCaseDescription });
    } else if (suggestion.type === 'document' && suggestion.documentType) {
      onAction({
        type: 'document',
        documentType: suggestion.documentType,
        useCaseDescription,
      });
    } else if (suggestion.type === 'playbook') {
      onAction({
        type: 'playbook',
        framework: suggestion.framework ?? 'Combined',
        useCaseDescription,
      });
    }
  };

  return (
    <div
      role="region"
      aria-label="Suggested next step"
      className="rounded-xl border border-terminal-cyan/30 bg-terminal-cyan/5 p-4"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-terminal-cyan shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono uppercase tracking-wider text-terminal-cyan mb-1">
            Suggested next step
          </p>
          <p className="text-sm font-sans text-terminal-text leading-relaxed">
            {suggestion.reason}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCommit}
              disabled={!isPaidUser}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-md border border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={isPaidUser ? undefined : 'Requires a Pro subscription'}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="inline-flex items-center gap-1 text-xs font-mono text-terminal-muted hover:text-terminal-text transition-colors px-2 py-1.5"
            >
              Keep chatting
            </button>
            {!isPaidUser && (
              <span className="text-[10px] font-mono text-terminal-muted">
                Pro required for structured generation
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss suggestion"
          className="text-terminal-muted hover:text-terminal-text transition-colors p-1 -mr-1 -mt-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
