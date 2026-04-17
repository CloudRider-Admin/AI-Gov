'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Users, MessageSquare, FileText, Zap, AlertTriangle, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

interface DashboardStats {
  totalQueries: number;
  totalArtifacts: number;
  totalUsers: number;
  activeUsersToday: number;
  queriesLast7Days: number[];
  artifactsByType: Record<string, number>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  tokenUsageByDay: Array<{ date: string; tokens: number }>;
  errorRate: number;
  avgResponseTimeMs: number;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Build chart data
  const queriesChartData = stats?.queriesLast7Days.map((count, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), queries: count };
  }) ?? [];

  const artifactPieData = stats
    ? Object.entries(stats.artifactsByType).map(([name, value]) => ({ name, value }))
    : [];

  const tokenChartData = stats?.tokenUsageByDay.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tokens: d.tokens,
  })) ?? [];

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {error}</p>
          <button onClick={fetchStats} className="mt-2 text-sm underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform usage and performance metrics</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<MessageSquare className="h-5 w-5 text-blue-500" />}
          label="Total Queries"
          value={formatNumber(stats.totalQueries)}
        />
        <StatCard
          icon={<FileText className="h-5 w-5 text-emerald-500" />}
          label="Artifacts Generated"
          value={formatNumber(stats.totalArtifacts)}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-violet-500" />}
          label="Total Users"
          value={formatNumber(stats.totalUsers)}
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          label="Active Today"
          value={String(stats.activeUsersToday)}
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Queries over last 7 days */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Queries (Last 7 Days)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={queriesChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="queries" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Artifact breakdown */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Artifacts by Type</h3>
          {artifactPieData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              No artifacts yet
            </div>
          ) : (
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={artifactPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {artifactPieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {artifactPieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="capitalize">{entry.name}</span>
                    <span className="ml-auto text-muted-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Token Usage Chart */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Token Usage (Last 7 Days)</h3>
        <div className="h-56">
          {tokenChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No token data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tokenChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatNumber(v)} />
                <Tooltip formatter={(v: number) => [formatNumber(Number(v)), 'Tokens']} />
                <Area type="monotone" dataKey="tokens" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row: Endpoints + Metrics */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Endpoints */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Top Endpoints</h3>
          <div className="space-y-3">
            {stats.topEndpoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No endpoint data yet</p>
            ) : (
              stats.topEndpoints.map((ep) => {
                const maxCount = Math.max(...stats.topEndpoints.map(e => e.count));
                const pct = maxCount > 0 ? (ep.count / maxCount) * 100 : 0;
                return (
                  <div key={ep.endpoint}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-mono text-xs">{ep.endpoint}</span>
                      <span className="text-muted-foreground">{formatNumber(ep.count)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Health Metrics */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Health Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Error Rate (24h)
              </span>
              <span className={`text-sm font-semibold ${stats.errorRate > 5 ? 'text-red-500' : stats.errorRate > 1 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {stats.errorRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Avg Response Time
              </span>
              <span className="text-sm font-semibold text-muted-foreground">
                {stats.avgResponseTimeMs > 0 ? `${stats.avgResponseTimeMs}ms` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                Users Active Today
              </span>
              <span className="text-sm font-semibold">{stats.activeUsersToday}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
