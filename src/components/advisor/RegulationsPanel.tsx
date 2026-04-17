'use client';

import { CheckCircle2 } from 'lucide-react';
import { relevanceCopy, type RegulationMatch } from '@/types/advisor';

interface RegulationsPanelProps {
  regulations: RegulationMatch[];
}

export function RegulationsPanel({ regulations }: RegulationsPanelProps) {
  if (!regulations.length) return null;

  return (
    <div className="mb-6">
      <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> Regulation Check
      </h4>
      <div className="space-y-3">
        {regulations.map((reg, idx) => {
          const relevance = relevanceCopy[reg.relevance] ?? relevanceCopy.medium;
          return (
            <div
              key={`${reg.regulation}-${reg.article}-${idx}`}
              className="border border-terminal-border rounded-md p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-terminal-text">
                  {reg.regulation} · {reg.article}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full font-mono ${relevance.badge}`}>
                  {relevance.label}
                </span>
              </div>
              <p className="text-sm text-terminal-muted">{reg.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
