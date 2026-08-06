'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
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
import {
  AppPage,
  PageHeader,
  Panel,
  KpiCard,
  formatCompact,
  formatDelta,
  deltaTone,
} from '@/components/app';

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

// Categorical series colors. Kept as hex because Recharts fills are painted
// outside Tailwind's class pipeline; these track the terminal-* tokens.
const SERIES_COLORS = ['#00cc66', '#f59e0b', '#06b6d4', '#a855f7', '#eab308', '#22c55e'];

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
      <AppPage>
        <div className="flex min-h-[50vh] items-center justify-center gap-2 font-mono text-sm text-terminal-muted">
          <RefreshCw className="h-5 w-5 animate-spin" /> Loading telemetry…
        </div>
      </AppPage>
    );
  }

  if (error && !stats) {
    return (
      <AppPage>
        <div className="rounded-xl border border-terminal-red/40 bg-terminal-red/10 p-4 text-sm text-terminal-red">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
          <button onClick={() => fetchStats()} className="mt-2 text-xs underline">
            Retry
          </button>
        </div>
      </AppPage>
    );
  }

  if (!stats) return null;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Platform / Admin"
        title="Analytics"
        description="Platform telemetry — query volume, artifact output, token consumption, and endpoint health."
        actions={
          <>
            <span className="inline-flex items-center rounded-full border border-terminal-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-terminal-muted">
              Last 24 hours
            </span>
            <button
              onClick={() => fetchStats()}
              disabled={refreshing}
              className="btn-secondary py-2 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 text-sm text-terminal-red">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          tone="green"
          label="Total queries"
          value={formatCompact(stats.totalQueries)}
          delta={formatDelta(stats.deltas.totalQueriesPct)}
          deltaTone={deltaTone(stats.deltas.totalQueriesPct)}
          onClick={() => setOpenStat('queries')}
        />
        <KpiCard
          tone="amber"
          label="Artifacts"
          value={formatCompact(stats.totalArtifacts)}
          delta={formatDelta(stats.deltas.totalArtifactsPct)}
          deltaTone={deltaTone(stats.deltas.totalArtifactsPct)}
          onClick={() => setOpenStat('artifacts')}
        />
        <KpiCard
          tone="cyan"
          label="Total users"
          value={formatCompact(stats.totalUsers)}
          delta={formatDelta(stats.deltas.totalUsersPct)}
          deltaTone={deltaTone(stats.deltas.totalUsersPct)}
          onClick={() => setOpenStat('users')}
        />
        <KpiCard
          tone="green"
          label="Active today"
          value={formatCompact(stats.activeUsersToday)}
          delta={formatDelta(stats.deltas.activeTodayPct)}
          deltaTone={deltaTone(stats.deltas.activeTodayPct)}
          onClick={() => setOpenStat('active')}
        />
      </div>

      {/* ── Token usage + artifact mix ───────────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Token usage · 24h"
          action={
            <span className="flex items-center gap-3 text-terminal-muted">
              <LegendDot color="bg-terminal-green" label="Input" />
              <LegendDot color="bg-terminal-amber" label="Output" />
            </span>
          }
          padded
        >
          <div className="h-60 w-full min-w-0">
            {tokenChartData.every((b) => b.input === 0 && b.output === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-terminal-muted">
                No token activity in the last 24 hours.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={tokenChartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fontFamily: 'var(--font-space-mono)' }}
                    interval={Math.floor(tokenChartData.length / 6) || 0}
                    stroke="currentColor"
                    className="text-terminal-muted"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fontFamily: 'var(--font-space-mono)' }}
                    tickFormatter={(v: number) => formatCompact(v)}
                    stroke="currentColor"
                    className="text-terminal-muted"
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    contentStyle={{
                      fontFamily: 'var(--font-space-mono)',
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => formatCompact(Number(v))}
                  />
                  <Bar dataKey="input" stackId="a" fill="#00cc66" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="output" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Artifacts by type" padded>
          {donutData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-terminal-muted">
              No artifacts yet
            </div>
          ) : (
            <>
              <div className="relative h-48 w-full min-w-0">
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
                        <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontFamily: 'var(--font-space-mono)', fontSize: 12, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-3xl font-bold tabular-nums text-terminal-text">
                    {formatCompact(stats.artifactTotal)}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
                    Total
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {donutData.map((d, i) => {
                  const pct = stats.artifactTotal > 0 ? Math.round((d.value / stats.artifactTotal) * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <span className="capitalize text-terminal-text">{d.name.replace(/_/g, ' ')}</span>
                      <span className="ml-auto font-mono tabular-nums text-terminal-muted">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ── Weekly queries + service health ──────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Queries · last 7 days" padded>
          <div className="flex h-56 items-end justify-around px-2">
            {weeklyData.map((d, i) => {
              const max = Math.max(1, ...weeklyData.map((x) => x.queries));
              const h = Math.max(6, Math.round((d.queries / max) * 160));
              const isPeak = i === peakQueriesIdx;
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                  <span
                    className={`font-mono text-xs uppercase tracking-wider ${
                      isPeak ? 'font-bold text-terminal-green' : 'text-terminal-muted'
                    }`}
                  >
                    {d.day}
                  </span>
                  <div
                    className={`w-10 rounded-t-md transition-all md:w-12 ${
                      isPeak ? 'bg-terminal-green' : 'border border-terminal-border bg-terminal-gray'
                    }`}
                    style={{ height: `${h}px` }}
                    title={`${d.queries} queries`}
                  />
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Service health" padded>
          <dl className="space-y-5">
            <HealthRow
              label="Request success rate"
              value={`${(100 - stats.systemHealth.errorRate).toFixed(2)}%`}
              note={`${stats.systemHealth.errorRate.toFixed(2)}% errored · 24h`}
              tone={stats.systemHealth.errorRate > 1 ? 'amber' : 'green'}
            />
            <HealthRow
              label="Database round-trip"
              value={`${stats.systemHealth.latencyP99Ms}ms`}
              note={stats.systemHealth.verdict}
              tone={
                stats.systemHealth.verdict === 'Optimal'
                  ? 'green'
                  : stats.systemHealth.verdict === 'Degraded'
                  ? 'amber'
                  : 'red'
              }
            />
            <HealthRow
              label="Avg response time"
              value={`${stats.avgResponseTimeMs}ms`}
              note="sampled this request"
              tone="muted"
            />
          </dl>
        </Panel>
      </div>

      {/* ── Top API endpoints ────────────────────────────────────── */}
      <Panel title="Top API endpoints · 24h">
        {stats.topEndpoints.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-terminal-muted">
            No endpoint activity in the last 24 hours.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-terminal-border bg-terminal-gray/30 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  <th className="px-4 py-2.5 font-semibold">Endpoint</th>
                  <th className="px-4 py-2.5 font-semibold">Calls</th>
                  <th className="px-4 py-2.5 font-semibold">Success rate</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Avg payload</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Trend</th>
                </tr>
              </thead>
              <tbody>
                {stats.topEndpoints.map((ep) => (
                  <tr
                    key={ep.endpoint}
                    className="border-b border-terminal-border/50 transition-colors duration-300 last:border-b-0 hover:bg-terminal-gray/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-terminal-green">
                      /{ep.endpoint.replace(/^\/+/, '')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-terminal-text">
                      {ep.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <SuccessBar pct={ep.successRate} />
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs tabular-nums text-terminal-muted sm:table-cell">
                      {ep.avgPayloadKb.toFixed(1)} KB
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ep.trend === 'up' ? (
                        <TrendingUp className="inline h-4 w-4 text-terminal-green" aria-label="trending up" />
                      ) : ep.trend === 'down' ? (
                        <TrendingDown className="inline h-4 w-4 text-terminal-amber" aria-label="trending down" />
                      ) : (
                        <Minus className="inline h-4 w-4 text-terminal-muted" aria-label="flat" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <StatDetailDrawer
        openStat={openStat}
        stats={stats}
        weeklyData={weeklyData}
        donutData={donutData}
        onClose={() => setOpenStat(null)}
      />
    </AppPage>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function HealthRow({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'green' | 'amber' | 'red' | 'muted';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-terminal-green'
      : tone === 'amber'
      ? 'text-terminal-amber'
      : tone === 'red'
      ? 'text-terminal-red'
      : 'text-terminal-muted';
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-terminal-muted">{label}</dt>
      <dd className="mt-1 flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xl font-bold tabular-nums text-terminal-text">{value}</span>
        <span className={`font-mono text-xs ${toneClass}`}>{note}</span>
      </dd>
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
    openStat === 'queries' ? 'Total queries'
      : openStat === 'artifacts' ? 'Artifacts'
        : openStat === 'users' ? 'Total users'
          : openStat === 'active' ? 'Active today'
            : '';

  if (!mounted) return null;

  const content = (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${title} breakdown`}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-full flex-col border-l border-terminal-border bg-terminal-dark shadow-2xl transition-transform duration-200 ease-out sm:w-[420px] md:w-[460px] lg:w-[500px] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-terminal-border px-5 py-4 md:px-6">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-wider text-terminal-muted">Breakdown</p>
            <h2 className="truncate font-mono text-lg font-bold text-terminal-text">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-2 text-terminal-muted transition-colors hover:bg-terminal-gray/40 hover:text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-green/50"
            aria-label="Close breakdown"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 pb-24 md:p-6 md:pb-6">
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

function DrawerMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-gray/30 p-4">
      <div className="mb-1.5 font-mono text-xs uppercase tracking-wider text-terminal-muted">{label}</div>
      <div className="font-mono text-2xl font-bold tabular-nums text-terminal-text">{value}</div>
      {sub && <div className="mt-1 font-sans text-xs text-terminal-muted">{sub}</div>}
    </div>
  );
}

function DrawerSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-mono text-xs uppercase tracking-wider text-terminal-muted">{children}</div>
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
          label="All time"
          value={formatCompact(stats.totalQueries)}
          sub={`${formatDelta(stats.deltas.totalQueriesPct)} vs prior 24h`}
        />
        <DrawerMetric label="Last 7 days" value={formatCompact(last7)} sub={`${formatDelta(wow)} WoW`} />
        <DrawerMetric label="Avg / day (7d)" value={formatCompact(avgPerDay)} />
        <DrawerMetric
          label="Error rate"
          value={`${stats.errorRate.toFixed(2)}%`}
          sub={`Avg response ${stats.avgResponseTimeMs}ms`}
        />
      </div>

      <div>
        <DrawerSectionLabel>Daily distribution · last 7 days</DrawerSectionLabel>
        <div className="space-y-2">
          {weeklyData.map((d) => (
            <div key={d.day} className="flex items-center gap-3 text-xs">
              <span className="w-10 font-mono text-terminal-muted">{d.day}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-terminal-gray/40">
                <div
                  className="h-full bg-terminal-green"
                  style={{ width: `${Math.max(2, (d.queries / max) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono tabular-nums text-terminal-text">
                {formatCompact(d.queries)}
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
          label="All time"
          value={formatCompact(stats.totalArtifacts)}
          sub={`${formatDelta(stats.deltas.totalArtifactsPct)} vs prior 24h`}
        />
        <DrawerMetric label="Types" value={String(sorted.length)} sub="distinct categories" />
      </div>

      <div>
        <DrawerSectionLabel>Distribution by type</DrawerSectionLabel>
        {sorted.length === 0 ? (
          <p className="text-sm text-terminal-muted">No artifacts generated yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((d, i) => {
              const pct = stats.artifactTotal > 0 ? (d.value / stats.artifactTotal) * 100 : 0;
              const color = SERIES_COLORS[i % SERIES_COLORS.length];
              return (
                <div key={d.name} className="flex items-center gap-3 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="w-28 truncate capitalize text-terminal-text">
                    {d.name.replace(/_/g, ' ')}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-terminal-gray/40">
                    <div
                      className="h-full"
                      style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono tabular-nums text-terminal-text">
                    {formatCompact(d.value)} ({pct.toFixed(0)}%)
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
          label="All time"
          value={formatCompact(stats.totalUsers)}
          sub={`${formatDelta(stats.deltas.totalUsersPct)} new last 24h`}
        />
        <DrawerMetric
          label="Active today"
          value={formatCompact(stats.activeUsersToday)}
          sub={`${activeRate.toFixed(1)}% of total`}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-terminal-border p-4">
        <DrawerSectionLabel>Engagement</DrawerSectionLabel>
        <div className="flex items-center gap-3 text-xs">
          <span className="w-28 text-terminal-muted">Active / total</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-terminal-gray/40">
            <div
              className="h-full bg-terminal-green"
              style={{ width: `${Math.max(2, Math.min(100, activeRate))}%` }}
            />
          </div>
          <span className="w-14 text-right font-mono tabular-nums text-terminal-text">
            {activeRate.toFixed(1)}%
          </span>
        </div>
      </div>

      <p className="font-sans text-xs leading-relaxed text-terminal-muted">
        New-user growth is measured on a rolling 24-hour window. For cohort retention and lifecycle
        breakdowns, see the full user analytics page.
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
          label="Active today"
          value={formatCompact(stats.activeUsersToday)}
          sub={`${formatDelta(delta)} vs yesterday`}
        />
        <DrawerMetric
          label="% of userbase"
          value={`${activeRate.toFixed(1)}%`}
          sub={`of ${formatCompact(stats.totalUsers)} total users`}
        />
      </div>

      <div className="space-y-2 rounded-xl border border-terminal-border p-4">
        <DrawerSectionLabel>Day-over-day change</DrawerSectionLabel>
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${
              delta > 0 ? 'text-terminal-green' : delta < 0 ? 'text-terminal-amber' : 'text-terminal-muted'
            }`}
          >
            {formatDelta(delta)}
          </span>
          <span className="text-xs text-terminal-muted">vs previous day</span>
        </div>
      </div>

      <p className="font-sans text-xs leading-relaxed text-terminal-muted">
        &ldquo;Active&rdquo; is any authenticated user who generated an analytics event since 00:00 UTC.
        Guest traffic is not counted.
      </p>
    </>
  );
}

function SuccessBar({ pct }: { pct: number }) {
  const tone = pct >= 99 ? 'bg-terminal-green' : pct >= 95 ? 'bg-terminal-green/80' : 'bg-terminal-amber';
  const toneText = pct >= 95 ? 'text-terminal-green' : 'text-terminal-amber';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 max-w-[120px] flex-1 overflow-hidden rounded-full bg-terminal-gray">
        <div className={`h-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className={`font-mono text-xs tabular-nums ${toneText}`}>{pct.toFixed(1)}%</span>
    </div>
  );
}
