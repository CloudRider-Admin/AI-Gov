'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AdvisorErrorProps {
  error: string;
  onRetry?: () => void;
}

export function AdvisorError({ error, onRetry }: AdvisorErrorProps) {
  return (
    <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded px-4 py-3 font-mono text-sm mb-6">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">Advisor temporarily unavailable</p>
          <p>{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-red-500/40 rounded hover:bg-red-500/20 hover:text-red-200 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
