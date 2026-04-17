'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface BudgetData {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

interface TokenBudgetIndicatorProps {
  refreshKey: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TokenBudgetIndicator({ refreshKey }: TokenBudgetIndicatorProps) {
  const [budget, setBudget] = useState<BudgetData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/token-budget')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data) setBudget(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!budget || budget.limit === 0) return null;

  const pct = budget.percentUsed;
  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-terminal-green';
  const textColor = pct > 80 ? 'text-red-400' : pct > 50 ? 'text-yellow-400' : 'text-terminal-muted';

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-terminal-border bg-terminal-gray/20">
      <Zap className={`w-3 h-3 ${textColor}`} />
      <div className="flex-1 h-1 bg-terminal-border rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${textColor} whitespace-nowrap`}>
        {formatTokens(budget.used)} / {formatTokens(budget.limit)}
      </span>
    </div>
  );
}
