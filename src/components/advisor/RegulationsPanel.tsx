'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { relevanceCopy, type RegulationMatch, type SourceProvenance } from '@/types/advisor';
import { RegulationDetailPanel } from './RegulationDetailPanel';

interface RegulationsPanelProps {
  regulations: RegulationMatch[];
  /**
   * Structured provenance for the response. Preferred over `sources` —
   * lets the panel filter by `type === 'govsecure'` instead of string-
   * matching the human label.
   */
  sourcesStructured?: SourceProvenance[];
  /**
   * Legacy flat label list. Used as a fallback for old conversations
   * persisted before structured provenance shipped (Issue #5). Detection
   * falls back to `startsWith('GovSecure Governance Library')`.
   */
  sources?: string[];
  /**
   * The advisor query that produced these regulation matches. Passed
   * through to the explainer endpoint so on-demand LLM fallbacks can
   * tailor the body to the user's actual question.
   */
  query?: string;
}

const GOVSECURE_SOURCE_MARKER = 'GovSecure Governance Library';

export function RegulationsPanel({
  regulations,
  sourcesStructured,
  sources = [],
  query,
}: RegulationsPanelProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!regulations.length) return null;
  const govSecureCitations = sourcesStructured
    ? sourcesStructured.filter((s) => s.type === 'govsecure').map((s) => s.label)
    : sources.filter((s) => s.startsWith(GOVSECURE_SOURCE_MARKER));

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Regulation Check
        </h4>
        {govSecureCitations.length > 0 && (
          <span
            title={govSecureCitations.join('\n')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-terminal-green/10 text-terminal-green border border-terminal-green/30 flex items-center gap-1"
          >
            <ShieldCheck className="w-3 h-3" />
            Cross-checked against GovSecure Library ({govSecureCitations.length})
          </span>
        )}
      </div>
      <div className="space-y-3">
        {regulations.map((reg, idx) => {
          const relevance = relevanceCopy[reg.relevance] ?? relevanceCopy.medium;
          const isExpanded = expandedIdx === idx;
          const panelId = `reg-detail-${idx}`;

          return (
            <div
              key={`${reg.regulation}-${reg.article}-${idx}`}
              className="border border-terminal-border rounded-xl bg-terminal-gray/30 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="w-full text-left p-4 hover:bg-terminal-gray/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-green/60 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-semibold text-terminal-text font-mono">
                    {reg.regulation} · {reg.article}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-mono ${relevance.badge}`}>
                      {relevance.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-terminal-muted" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-terminal-muted" aria-hidden="true" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-terminal-text font-sans leading-relaxed">
                  {reg.description}
                </p>
                {!isExpanded && (
                  <p className="mt-2 text-[11px] font-mono text-terminal-green/70">
                    Click to read in full →
                  </p>
                )}
              </button>
              {isExpanded && (
                <div id={panelId} className="px-4 pb-4">
                  <RegulationDetailPanel
                    regulation={reg.regulation}
                    article={reg.article}
                    query={query}
                    onClose={() => setExpandedIdx(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
