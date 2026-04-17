'use client';

import { Loader2 } from 'lucide-react';

export function AdvisorLoading() {
  return (
    <div className="border-t border-terminal-border pt-6 animate-fade-in">
      <div className="flex items-center gap-2 text-terminal-muted font-mono text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-terminal-green" />
        <span>Analyzing use case...</span>
      </div>
      <div className="mt-2 space-y-2 text-terminal-muted font-mono text-sm">
        <p><span className="text-terminal-green">→</span> Evaluating risk profile</p>
        <p><span className="text-terminal-green">→</span> Matching regulations</p>
        <p><span className="text-terminal-green">→</span> Generating policy recommendations</p>
      </div>
    </div>
  );
}
