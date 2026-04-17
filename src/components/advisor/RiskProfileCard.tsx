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
      <p className={`text-terminal-text font-sans text-sm bg-terminal-gray/50 p-3 rounded border border-terminal-border ${copy.color}`}>
        {riskProfile.description}
      </p>
      {riskProfile.reasoning?.length > 0 && (
        <ul className="mt-3 space-y-1 text-terminal-muted text-sm font-mono">
          {riskProfile.reasoning.map((reason, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-terminal-green">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
