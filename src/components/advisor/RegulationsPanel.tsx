'use client';

import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { relevanceCopy, type RegulationMatch, type SourceProvenance } from '@/types/advisor';

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
}

const GOVSECURE_SOURCE_MARKER = 'GovSecure Governance Library';

export function RegulationsPanel({ regulations, sourcesStructured, sources = [] }: RegulationsPanelProps) {
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
          return (
            <div
              key={`${reg.regulation}-${reg.article}-${idx}`}
              className="border border-terminal-border rounded-xl bg-terminal-gray/30 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-terminal-text font-mono">
                  {reg.regulation} · {reg.article}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full font-mono ${relevance.badge}`}>
                  {relevance.label}
                </span>
              </div>
              <p className="text-sm text-terminal-text font-sans leading-relaxed">{reg.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
