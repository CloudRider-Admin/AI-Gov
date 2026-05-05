'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Zap, TrendingUp, BarChart3, RefreshCw } from 'lucide-react';

interface CostData {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  cost: {
    estimatedCost: number;
    avgCostPerQuery: number;
    avgTokensPerQuery: number;
    queryCount: number;
    promptTokens: number;
    completionTokens: number;
    projectedMonthlyTokens: number;
    daysRemaining: number;
    dailyBreakdown: {
      day: string;
      promptTokens: number;
      completionTokens: number;
      queries: number;
    }[];
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-terminal-green" />
        <span className="text-xs font-mono text-terminal-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-terminal-text">{value}</div>
      {sub && <div className="text-xs font-mono text-terminal-muted mt-1">{sub}</div>}
    </div>
  );
}

export function CostDashboard() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/token-budget');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-terminal-muted" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-terminal-muted text-sm font-mono">Failed to load cost data.</div>;
  }

  const { cost } = data;
  const maxBar = Math.max(...cost.dailyBreakdown.map(d => d.promptTokens + d.completionTokens), 1);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Est. Cost (MTD)"
          value={`$${cost.estimatedCost.toFixed(2)}`}
          sub={`${cost.daysRemaining} days remaining`}
        />
        <StatCard
          icon={Zap}
          label="Queries (MTD)"
          value={cost.queryCount.toString()}
          sub={`~$${cost.avgCostPerQuery.toFixed(3)}/query`}
        />
        <StatCard
          icon={BarChart3}
          label="Tokens Used"
          value={formatTokens(data.used)}
          sub={`of ${data.limit === Infinity ? '∞' : formatTokens(data.limit)} budget`}
        />
        <StatCard
          icon={TrendingUp}
          label="Projected Month"
          value={formatTokens(cost.projectedMonthlyTokens)}
          sub={`${cost.avgTokensPerQuery.toLocaleString()} avg/query`}
        />
      </div>

      {/* Budget bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-terminal-muted">Monthly Token Budget</span>
          <span className="text-xs font-mono text-terminal-text">{data.percentUsed}%</span>
        </div>
        <div className="h-3 bg-terminal-gray/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              data.percentUsed >= 90
                ? 'bg-terminal-red'
                : data.percentUsed >= 70
                  ? 'bg-terminal-amber'
                  : 'bg-terminal-green'
            }`}
            style={{ width: `${Math.min(data.percentUsed, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs font-mono text-terminal-muted">{formatTokens(data.used)} used</span>
          <span className="text-xs font-mono text-terminal-muted">{formatTokens(data.remaining)} remaining</span>
        </div>
      </div>

      {/* Token split */}
      <div className="card p-4">
        <h3 className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-3">Token Breakdown</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-mono text-terminal-text">{formatTokens(cost.promptTokens)}</div>
            <div className="text-xs font-mono text-terminal-muted">Input tokens</div>
          </div>
          <div>
            <div className="text-sm font-mono text-terminal-text">{formatTokens(cost.completionTokens)}</div>
            <div className="text-xs font-mono text-terminal-muted">Output tokens</div>
          </div>
        </div>
      </div>

      {/* Daily usage chart (simple bar chart) */}
      {cost.dailyBreakdown.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-3">Daily Usage</h3>
          <div className="flex items-end gap-1 h-32">
            {cost.dailyBreakdown.map((d) => {
              const total = d.promptTokens + d.completionTokens;
              const heightPercent = (total / maxBar) * 100;
              const promptPercent = total > 0 ? (d.promptTokens / total) * 100 : 0;
              const dayLabel = new Date(d.day).getDate().toString();
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${dayLabel}: ${formatTokens(total)} tokens, ${d.queries} queries`}>
                  <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                    <div
                      className="w-full rounded-t relative overflow-hidden"
                      style={{ height: `${heightPercent}%`, minHeight: total > 0 ? '2px' : 0 }}
                    >
                      <div className="absolute inset-0 bg-terminal-green/60" />
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-terminal-green"
                        style={{ height: `${promptPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-mono text-terminal-muted">{dayLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs font-mono text-terminal-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-terminal-green rounded-md" /> Input</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-terminal-green/60 rounded-md" /> Output</span>
          </div>
        </div>
      )}
    </div>
  );
}