'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  RefreshCw,
  AlertTriangle,
  Database,
  Archive,
  Users,
  Zap,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface EndpointStat {
  endpoint: string;
  count: number;
  successRate: number;
  avgPayloadKb: number;
  trend: 'up' | 'down' | 'flat';
}

interface SystemHealth {
  clusterUptimePct: number;
  latencyP99Ms: number;
  errorRate: number;
  verdict: 'Optimal' | 'Degraded' | 'Slow';
}

interface DashboardStats {
  totalQueries: number;
  totalArtifacts: number;
  totalUsers: number;
  activeUsersToday: number;
  queriesLast7Days: number[];
  queriesPrev7Days: number[];
  artifactsByType: Record<string, number>;
  artifactTotal: number;
  topEndpoints: EndpointStat[];
  tokenUsageByDay: Array<{ date: string; tokens: number }>;
  tokenUsageHourly: Array<{ hour: string; input: number; output: number }>;
  systemHealth: SystemHealth;
  errorRate: number;
  avgResponseTimeMs: number;
  deltas: {
    totalQueriesPct: number;
    totalArtifactsPct: number;
    totalUsersPct: number;
    activeTodayPct: number;
  };
}

const POLL_MS = 60_000;
const DONUT_COLORS = ['#00cc66', '#22c55e', '#f97316', '#06b6d4', '#a855f7', '#eab308'];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatPct(n: number): string {
  if (n === 0) return 'Stable';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function pctTone(n: number): string {
  if (n === 0) return 'text-terminal-muted';
  return n > 0 ? 'text-terminal-green' : 'text-terminal-amber';
}

type StatKey = 'queries' | 'artifacts' | 'users' | 'active';

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStat, setOpenStat] = useState<StatKey | null>(null);

  useEffect(() => {
    if (!openStat) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenStat(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openStat]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      setStats(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => fetchStats(true), POLL_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Prepare chart data
  const tokenChartData = useMemo(() => {
    if (!stats) return [];
    return stats.tokenUsageHourly.map((b) => ({
      label: new Date(b.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      input: b.input,
      output: b.output,
    }));
  }, [stats]);

  const donutData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.artifactsByType).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const weeklyData = useMemo(() => {
    if (!stats) return [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return stats.queriesLast7Days.map((count, i) => {
      const d = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      return {
        day: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        queries: count,
      };
    });
  }, [stats]);

  const peakQueriesIdx = useMemo(() => {
    if (!weeklyData.length) return -1;
    let best = 0;
    for (let i = 1; i < weeklyData.length; i++) {
      if (weeklyData[i].queries > weeklyData[best].queries) best = i;
    }
    return weeklyData[best].queries > 0 ? best : -1;
  }, [weeklyData]);

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 font-mono text-sm text-terminal-muted">
          <RefreshCw className="h-5 w-5 animate-spin" /> Loading system intelligence…
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-terminal-red/40 bg-terminal-red/10 p-4 font-mono text-sm text-terminal-red">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
          <button onClick={() => fetchStats()} className="mt-2 text-xs underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto font-mono space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-terminal-text tracking-tight mb-2">
            System Intelligence
          </h1>
          <p className="text-sm text-terminal-muted max-w-xl">
            Real-time governance telemetry and operational metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-2 text-[11px] uppercase tracking-[0.18em] rounded-xl border border-terminal-border text-terminal-muted">
            Last 24 Hours
          </span>
          <button
            onClick={() => fetchStats()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-terminal-green text-terminal-black px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-terminal-green/90 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh View
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {/* ── Stat row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AccentStat
          label="Total Queries"
          value={formatNumber(stats.totalQueries)}
          delta={stats.deltas.totalQueriesPct}
          accent="green"
          icon={Database}
          onClick={() => setOpenStat('queries')}
        />
        <AccentStat
          label="Artifacts"
          value={formatNumber(stats.totalArtifacts)}
          delta={stats.deltas.totalArtifactsPct}
          accent="amber"
          icon={Archive}
          onClick={() => setOpenStat('artifacts')}
        />
        <AccentStat
          label="Total Users"
          value={formatNumber(stats.totalUsers)}
          delta={stats.deltas.totalUsersPct}
          accent="neutral"
          icon={Users}
          onClick={() => setOpenStat('users')}
        />
        <AccentStat
          label="Active Today"
          value={formatNumber(stats.activeUsersToday)}
          delta={stats.deltas.activeTodayPct}
          accent="green"
          icon={Zap}
          onClick={() => setOpenStat('active')}
        />
      </div>

      {/* ── Token usage + donut ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-terminal-text">Token Usage</h3>
              <p className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted mt-0.5">
                Resource consumption over 24H
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-terminal-muted">
              <LegendDot color="bg-terminal-green" label="Input" />
              <LegendDot color="bg-terminal-amber" label="Output" />
            </div>
          </div>
          <div className="w-full h-60 min-w-0">
            {tokenChartData.every((b) => b.input === 0 && b.output === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-terminal-muted">
                No token activity in the last 24 hours.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={tokenChartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fontFamily: 'var(--font-space-mono)' }}
                  interval={Math.floor(tokenChartData.length / 6) || 0}
                  stroke="currentColor"
                  className="text-terminal-muted"
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: 'var(--font-space-mono)' }}
                  tickFormatter={(v: number) => formatNumber(v)}
                  stroke="currentColor"
                  className="text-terminal-muted"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  contentStyle={{
                    fontFamily: 'var(--font-space-mono)',
                    fontSize: 11,
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => formatNumber(Number(v))}
                />
                <Bar dataKey="input" stackId="a" fill="#00cc66" radius={[4, 4, 0, 0]} />
                <Bar dataKey="output" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-terminal-text">Artifacts by Type</h3>
            <p className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted mt-0.5">
              Classification Profile
            </p>
          </div>
          {donutData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-terminal-muted">
              No artifacts yet
            </div>
          ) : (
            <>
              <div className="relative w-full h-48 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontFamily: 'var(--font-space-mono)', fontSize: 11, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-terminal-text">
                    {formatNumber(stats.artifactTotal)}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">Total</span>
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                {donutData.map((d, i) => {
                  const pct = stats.artifactTotal > 0 ? Math.round((d.value / stats.artifactTotal) * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      <span className="capitalize text-terminal-text">{d.name.replace(/_/g, ' ')}</span>
                      <span className="ml-auto text-terminal-muted">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Weekly bar + system health ────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 p-6">
          <h3 className="text-lg font-bold text-terminal-text mb-6">Queries (Last 7 Days)</h3>
          <div className="h-56 flex items-end justify-around px-2">
            {weeklyData.map((d, i) => {
              const max = Math.max(1, ...weeklyData.map((x) => x.queries));
              const h = Math.max(6, Math.round((d.queries / max) * 160));
              const isPeak = i === peakQueriesIdx;
              return (
                <div key={d.day} className="flex flex-col items-center gap-2 flex-1">
                  <span
                    className={`text-[10px] uppercase tracking-[0.18em] ${
                      isPeak ? 'text-terminal-green font-bold' : 'text-terminal-muted'
                    }`}
                  >
                    {d.day}
                  </span>
                  <div
                    className={`w-10 md:w-12 rounded-t-md transition-all ${
                      isPeak
                        ? 'bg-terminal-green'
                        : 'bg-terminal-gray border border-terminal-border'
                    }`}
                    style={{ height: `${h}px` }}
                    title={`${d.queries} queries`}
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Dark System Health card */}
        <div className="lg:col-span-2 rounded-xl p-6 space-y-5" style={{ backgroundColor: '#0f1012' }}>
          <h3 className="text-base font-bold text-terminal-green tracking-wide">SYSTEM HEALTH</h3>

          <HealthRow
            label="Cluster Uptime"
            value={`${stats.systemHealth.clusterUptimePct.toFixed(4)}%`}
            right={<CheckCircle2 className="w-5 h-5 text-terminal-green" />}
          />

          <HealthRow
            label="Latency (P99)"
            value={`${stats.systemHealth.latencyP99Ms}ms`}
            right={
              <span
                className={`text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-md border ${
                  stats.systemHealth.verdict === 'Optimal'
                    ? 'border-terminal-green/50 text-terminal-green'
                    : stats.systemHealth.verdict === 'Degraded'
                    ? 'border-terminal-amber/50 text-terminal-amber'
                    : 'border-terminal-red/50 text-terminal-red'
                }`}
              >
                {stats.systemHealth.verdict}
              </span>
            }
          />

          <HealthRow
            label="Error Rate"
            value={`${stats.systemHealth.errorRate.toFixed(3)}%`}
            right={<EqualizerBars />}
            tone="green"
          />
        </div>
      </div>

      {/* ── Top API endpoints ─────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-terminal-text">Top API Endpoints</h3>
          <Link
            href="/admin/knowledge"
            className="inline-flex items-center gap-1 text-xs text-terminal-green hover:underline"
          >
            Full API Logs <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {stats.topEndpoints.length === 0 ? (
          <p className="text-sm text-terminal-muted">No endpoint activity in the last 24 hours.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted border-b border-terminal-border">
                  <th className="text-left font-normal py-3 pr-4">Endpoint</th>
                  <th className="text-left font-normal py-3 pr-4">Calls (24h)</th>
                  <th className="text-left font-normal py-3 pr-4">Success Rate</th>
                  <th className="text-left font-normal py-3 pr-4">Avg Payload</th>
                  <th className="text-right font-normal py-3">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {stats.topEndpoints.map((ep) => (
                  <tr key={ep.endpoint} className="hover:bg-terminal-gray/30 transition-colors">
                    <td className="py-4 pr-4 text-terminal-green">/{ep.endpoint.replace(/^\/+/, '')}</td>
                    <td className="py-4 pr-4 text-terminal-text">{ep.count.toLocaleString()}</td>
                    <td className="py-4 pr-4">
                      <SuccessBar pct={ep.successRate} />
                    </td>
                    <td className="py-4 pr-4 text-terminal-text">{ep.avgPayloadKb.toFixed(1)} KB</td>
                    <td className="py-4 text-right">
                      {ep.trend === 'up' ? (
                        <TrendingUp className="inline w-4 h-4 text-terminal-green" />
                      ) : ep.trend === 'down' ? (
                        <TrendingDown className="inline w-4 h-4 text-terminal-amber" />
                      ) : (
                        <Minus className="inline w-4 h-4 text-terminal-muted" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <StatDetailDrawer
        openStat={openStat}
        stats={stats}
        weeklyData={weeklyData}
        donutData={donutData}
        onClose={() => setOpenStat(null)}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-terminal-border bg-terminal-black ${className}`}>{children}</div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function AccentStat({
  label,
  value,
  delta,
  accent,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  delta: number;
  accent: 'green' | 'amber' | 'neutral';
  icon: typeof Database;
  onClick?: () => void;
}) {
  const barColor =
    accent === 'green' ? 'bg-terminal-green' : accent === 'amber' ? 'bg-terminal-amber' : 'bg-terminal-muted';
  const deltaLabel = formatPct(delta);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${label} breakdown`}
      className="group relative rounded-xl border border-terminal-border bg-terminal-black p-4 overflow-hidden text-left transition-colors hover:border-terminal-green/60 focus:outline-none focus:ring-2 focus:ring-terminal-green/50 focus:ring-offset-0"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted truncate">
          {label}
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <ArrowUpRight className="w-3.5 h-3.5 text-terminal-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
          <Icon className="w-4 h-4 text-terminal-muted group-hover:text-terminal-green transition-colors" />
        </span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl md:text-3xl font-bold text-terminal-text">{value}</span>
        <span className={`text-[11px] ${deltaLabel === 'Stable' ? 'text-terminal-muted' : pctTone(delta)}`}>
          {deltaLabel}
        </span>
      </div>
      <div className={`mt-3 h-1 rounded-full ${barColor} opacity-60 group-hover:opacity-100 transition-opacity`} />
    </button>
  );
}

function HealthRow({
  label,
  value,
  right,
  tone = 'default',
}: {
  label: string;
  value: string;
  right: React.ReactNode;
  tone?: 'default' | 'green';
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-1.5">{label}</div>
      <div className="flex items-center justify-between">
        <span
          className={`text-2xl font-bold ${tone === 'green' ? 'text-terminal-green' : 'text-white'}`}
        >
          {value}
        </span>
        {right}
      </div>
    </div>
  );
}

function EqualizerBars() {
  // Static equalizer-style accent, matches the mock's abstract waveform glyph.
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[6, 10, 14, 8, 12, 16].map((h, i) => (
        <span key={i} className="w-0.5 bg-terminal-green rounded-sm" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

function StatDetailDrawer({
  openStat,
  stats,
  weeklyData,
  donutData,
  onClose,
}: {
  openStat: StatKey | null;
  stats: DashboardStats;
  weeklyData: Array<{ day: string; queries: number }>;
  donutData: Array<{ name: string; value: number }>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const open = openStat !== null;
  const title =
    openStat === 'queries' ? 'Total Queries'
      : openStat === 'artifacts' ? 'Artifacts'
      : openStat === 'users' ? 'Total Users'
      : openStat === 'active' ? 'Active Today'
      : '';

  if (!mounted) return null;

  const content = (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${title} breakdown`}
        className={`fixed inset-y-0 right-0 z-[70] flex flex-col w-full sm:w-[420px] md:w-[460px] lg:w-[500px] max-w-full bg-terminal-black border-l border-terminal-border shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-4 border-b border-terminal-border shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">Breakdown</p>
            <h2 className="text-lg font-bold text-terminal-text truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray/40 transition-colors focus:outline-none focus:ring-2 focus:ring-terminal-green/50"
            aria-label="Close breakdown"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 md:p-6 pb-24 md:pb-6 space-y-6">
          {openStat === 'queries' && <QueriesBreakdown stats={stats} weeklyData={weeklyData} />}
          {openStat === 'artifacts' && <ArtifactsBreakdown stats={stats} donutData={donutData} />}
          {openStat === 'users' && <UsersBreakdown stats={stats} />}
          {openStat === 'active' && <ActiveBreakdown stats={stats} />}
        </div>
      </aside>
    </>
  );

  return createPortal(content, document.body);
}

function DrawerMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-gray/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-terminal-text">{value}</div>
      {sub && <div className="text-[11px] text-terminal-muted mt-1">{sub}</div>}
    </div>
  );
}

function QueriesBreakdown({
  stats,
  weeklyData,
}: {
  stats: DashboardStats;
  weeklyData: Array<{ day: string; queries: number }>;
}) {
  const last7 = weeklyData.reduce((s, d) => s + d.queries, 0);
  const prev7 = stats.queriesPrev7Days ? stats.queriesPrev7Days.reduce((s, n) => s + n, 0) : 0;
  const wow = prev7 === 0 ? (last7 === 0 ? 0 : 100) : Math.round(((last7 - prev7) / prev7) * 1000) / 10;
  const avgPerDay = last7 > 0 ? Math.round(last7 / 7) : 0;
  const max = Math.max(1, ...weeklyData.map((d) => d.queries));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DrawerMetric
          label="All Time"
          value={formatNumber(stats.totalQueries)}
          sub={`${formatPct(stats.deltas.totalQueriesPct)} vs prior 24h`}
        />
        <DrawerMetric
          label="Last 7 Days"
          value={formatNumber(last7)}
          sub={`${formatPct(wow)} WoW`}
        />
        <DrawerMetric label="Avg / Day (7d)" value={formatNumber(avgPerDay)} />
        <DrawerMetric
          label="Error Rate"
          value={`${stats.errorRate.toFixed(2)}%`}
          sub={`Avg response ${stats.avgResponseTimeMs}ms`}
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted mb-3">
          Daily distribution (last 7 days)
        </div>
        <div className="space-y-2">
          {weeklyData.map((d) => (
            <div key={d.day} className="flex items-center gap-3 text-xs">
              <span className="w-10 text-terminal-muted">{d.day}</span>
              <div className="flex-1 h-2 rounded-full bg-terminal-gray/40 overflow-hidden">
                <div
                  className="h-full bg-terminal-green"
                  style={{ width: `${Math.max(2, (d.queries / max) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-terminal-text tabular-nums">
                {formatNumber(d.queries)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ArtifactsBreakdown({
  stats,
  donutData,
}: {
  stats: DashboardStats;
  donutData: Array<{ name: string; value: number }>;
}) {
  const sorted = [...donutData].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((d) => d.value));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DrawerMetric
          label="All Time"
          value={formatNumber(stats.totalArtifacts)}
          sub={`${formatPct(stats.deltas.totalArtifactsPct)} vs prior 24h`}
        />
        <DrawerMetric
          label="Types"
          value={String(sorted.length)}
          sub="distinct categories"
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted mb-3">
          Distribution by type
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-terminal-muted">No artifacts generated yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((d, i) => {
              const pct = stats.artifactTotal > 0 ? (d.value / stats.artifactTotal) * 100 : 0;
              const color = DONUT_COLORS[i % DONUT_COLORS.length];
              return (
                <div key={d.name} className="flex items-center gap-3 text-xs">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="w-28 capitalize text-terminal-text truncate">
                    {d.name.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-terminal-gray/40 overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="w-16 text-right text-terminal-text tabular-nums">
                    {formatNumber(d.value)} ({pct.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function UsersBreakdown({ stats }: { stats: DashboardStats }) {
  const activeRate = stats.totalUsers > 0 ? (stats.activeUsersToday / stats.totalUsers) * 100 : 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DrawerMetric
          label="All Time"
          value={formatNumber(stats.totalUsers)}
          sub={`${formatPct(stats.deltas.totalUsersPct)} new last 24h`}
        />
        <DrawerMetric
          label="Active Today"
          value={formatNumber(stats.activeUsersToday)}
          sub={`${activeRate.toFixed(1)}% of total`}
        />
      </div>

      <div className="rounded-xl border border-terminal-border p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">
          Engagement
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="w-28 text-terminal-muted">Active / Total</span>
          <div className="flex-1 h-2 rounded-full bg-terminal-gray/40 overflow-hidden">
            <div
              className="h-full bg-terminal-green"
              style={{ width: `${Math.max(2, Math.min(100, activeRate))}%` }}
            />
          </div>
          <span className="w-14 text-right text-terminal-text tabular-nums">
            {activeRate.toFixed(1)}%
          </span>
        </div>
      </div>

      <p className="text-xs text-terminal-muted leading-relaxed">
        New-user growth is measured on a rolling 24-hour window. For cohort retention and
        lifecycle breakdowns, see the full user analytics page.
      </p>
    </>
  );
}

function ActiveBreakdown({ stats }: { stats: DashboardStats }) {
  const activeRate = stats.totalUsers > 0 ? (stats.activeUsersToday / stats.totalUsers) * 100 : 0;
  const delta = stats.deltas.activeTodayPct;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DrawerMetric
          label="Active Today"
          value={formatNumber(stats.activeUsersToday)}
          sub={`${formatPct(delta)} vs yesterday`}
        />
        <DrawerMetric
          label="% of Userbase"
          value={`${activeRate.toFixed(1)}%`}
          sub={`of ${formatNumber(stats.totalUsers)} total users`}
        />
      </div>

      <div className="rounded-xl border border-terminal-border p-4 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">
          Day-over-day change
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold ${delta > 0 ? 'text-terminal-green' : delta < 0 ? 'text-terminal-amber' : 'text-terminal-muted'}`}
          >
            {formatPct(delta)}
          </span>
          <span className="text-xs text-terminal-muted">vs previous day</span>
        </div>
      </div>

      <p className="text-xs text-terminal-muted leading-relaxed">
        &ldquo;Active&rdquo; is any authenticated user who generated an analytics event since
        00:00 UTC. Guest traffic is not counted.
      </p>
    </>
  );
}

function SuccessBar({ pct }: { pct: number }) {
  const tone = pct >= 99 ? 'bg-terminal-green' : pct >= 95 ? 'bg-terminal-green/80' : 'bg-terminal-amber';
  const toneText = pct >= 99 ? 'text-terminal-green' : pct >= 95 ? 'text-terminal-green' : 'text-terminal-amber';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-terminal-gray overflow-hidden max-w-[120px]">
        <div className={`h-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className={`text-xs ${toneText}`}>{pct.toFixed(1)}%</span>
    </div>
  );
}
