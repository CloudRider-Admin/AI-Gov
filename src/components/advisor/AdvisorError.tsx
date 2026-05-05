'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AdvisorErrorProps {
  error: string;
  onRetry?: () => void;
}

export function AdvisorError({ error, onRetry }: AdvisorErrorProps) {
  return (
    <div className="border border-terminal-red/40 bg-terminal-red/10 text-terminal-red rounded-xl px-4 py-3 text-sm mb-6">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold font-mono">Advisor temporarily unavailable</p>
          <p className="font-sans mt-1 text-terminal-text">{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-terminal-red/40 rounded-md text-terminal-red hover:bg-terminal-red/20 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}