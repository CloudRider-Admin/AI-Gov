'use client';

import { riskLevelCopy, type AdvisorResponse } from '@/types/advisor';

interface RiskProfileCardProps {
  riskProfile: AdvisorResponse['riskProfile'];
  confidencePercent: string | null;
}

export function RiskProfileCard({ riskProfile, confidencePercent }: RiskProfileCardProps) {
  const level = riskProfile.level ?? 'medium';
  const copy = riskLevelCopy[level];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider">
          Risk Profile
        </h4>
        <span className={`text-xs px-3 py-1 rounded-full font-mono ${copy.badge}`}>
          {copy.label}
        </span>
        {confidencePercent && (
          <span className="text-xs text-terminal-muted font-mono">{confidencePercent}</span>
        )}
      </div>
      <p className={`text-terminal-text font-sans text-sm leading-relaxed bg-terminal-gray/30 p-4 rounded-md border border-terminal-border ${copy.color}`}>
        {riskProfile.description}
      </p>
      {riskProfile.reasoning?.length > 0 && (
        <ul className="mt-4 space-y-2 text-terminal-text text-sm font-sans leading-relaxed">
          {riskProfile.reasoning.map((reason, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-terminal-green font-mono shrink-0" aria-hidden="true">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
