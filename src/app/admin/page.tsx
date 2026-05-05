'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface AdminOverview {
  systemStatus: 'operational' | 'degraded' | 'down';
  generatedAt: string;
  knowledge: {
    total: number;
    embedded: number;
    pending: number;
    lastUpdatedAt: string | null;
  };
  users: {
    total: number;
    activeToday: number;
    contributorsLast7Days: number;
  };
  compliance: { score: number; deltaPct: number };
  latency: { dbMs: number; verdict: 'Optimal' | 'Degraded' | 'Slow' };
  sessions: { activeNow: number };
  errorRate24h: number;
}

const POLL_INTERVAL_MS = 30_000;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COPY: Record<AdminOverview['systemStatus'], { label: string; tone: string; dot: string }> = {
  operational: { label: 'SYSTEM ACTIVE', tone: 'bg-terminal-green/15 text-terminal-green', dot: 'bg-terminal-green' },
  degraded:    { label: 'SYSTEM DEGRADED', tone: 'bg-terminal-amber/15 text-terminal-amber', dot: 'bg-terminal-amber' },
  down:        { label: 'SYSTEM DOWN', tone: 'bg-terminal-red/15 text-terminal-red', dot: 'bg-terminal-red' },
};

export default function AdminIndexPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load overview');
      const data: AdminOverview = await res.json();
      setOverview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const id = setInterval(() => fetchOverview(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchOverview]);

  const status = STATUS_COPY[overview?.systemStatus ?? 'operational'];
  const lastRefreshed = overview?.generatedAt ? timeAgo(overview.generatedAt) : null;

  return (
    <div className="p-6 md:p-10 lg:p-12 max-w-6xl mx-auto space-y-10">
      {/* ── Status pill + refresh ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-xs ${status.tone}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${status.dot} ${
              overview?.systemStatus === 'operational' ? 'animate-pulse' : ''
            }`}
          />
          {status.label}
        </div>

        <button
          onClick={() => fetchOverview()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md border border-terminal-border px-3 py-1.5 font-mono text-xs text-terminal-muted hover:text-terminal-text hover:border-terminal-green/50 transition-colors disabled:opacity-50"
          aria-label="Refresh overview"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {lastRefreshed ? `Updated ${lastRefreshed}` : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
          <button onClick={() => fetchOverview()} className="ml-auto underline">
            Retry
          </button>
        </div>
      )}

      {/* ── Title + subtitle ───────────────────────────────────────── */}
      <div className="max-w-2xl">
        <h1 className="font-mono text-4xl md:text-5xl font-bold text-terminal-text tracking-tight mb-3">
          Admin Panel
        </h1>
        <p className="font-sans text-base text-terminal-muted leading-relaxed">
          Manage your GovSecure platform settings and monitor system health.
          Centralized control for AI governance and analytics.
        </p>
      </div>

      {/* ── Feature cards ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-5">
        <FeatureCard
          href="/admin/analytics"
          icon={BarChart3}
          iconTint="green"
          title="Analytics Dashboard"
          description="Monitor platform usage metrics, user engagement patterns, and AI processing throughput across your organization."
          footer={
            <ContributorsRow
              contributors={overview?.users.contributorsLast7Days}
              activeToday={overview?.users.activeToday}
              loading={loading}
            />
          }
        />
        <FeatureCard
          href="/admin/knowledge"
          icon={BookOpen}
          iconTint="neutral"
          title="Knowledge Base"
          description="Manage governance knowledge entries, update regulatory frameworks, and curate documentation for system guidance."
          footer={
            <MetaRow
              total={overview?.knowledge.total}
              lastUpdatedAt={overview?.knowledge.lastUpdatedAt ?? null}
              loading={loading}
            />
          }
        />
      </div>

      {/* ── Stat strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          icon={ShieldCheck}
          label="Compliance Score"
          value={overview ? overview.compliance.score.toFixed(1) : '—'}
          accent={formatDelta(overview?.compliance.deltaPct)}
          accentTone={deltaTone(overview?.compliance.deltaPct)}
          loading={loading}
        />
        <StatCard
          icon={Zap}
          label="API Latency"
          value={overview ? `${overview.latency.dbMs}ms` : '—'}
          accent={overview?.latency.verdict ?? '—'}
          accentTone={latencyTone(overview?.latency.verdict)}
          loading={loading}
        />
        <StatCard
          icon={Activity}
          label="Active Sessions"
          value={overview ? String(overview.sessions.activeNow) : '—'}
          accent={overview && overview.sessions.activeNow > 0 ? 'Live' : 'Idle'}
          accentTone={
            overview && overview.sessions.activeNow > 0 ? 'text-terminal-green' : 'text-terminal-muted'
          }
          loading={loading}
          live
        />
      </div>
    </div>
  );
}

// ── Formatting helpers ─────────────────────────────────────────────

function formatDelta(delta: number | undefined): string {
  if (delta === undefined) return '—';
  if (delta === 0) return 'Steady';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function deltaTone(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return 'text-terminal-muted';
  return delta > 0 ? 'text-terminal-green' : 'text-terminal-amber';
}

function latencyTone(verdict: AdminOverview['latency']['verdict'] | undefined): string {
  if (verdict === 'Optimal') return 'text-terminal-green';
  if (verdict === 'Degraded') return 'text-terminal-amber';
  if (verdict === 'Slow') return 'text-terminal-red';
  return 'text-terminal-muted';
}

// ── Sub-components ──────────────────────────────────────────────────

function FeatureCard({
  href,
  icon: Icon,
  iconTint,
  title,
  description,
  footer,
}: {
  href: string;
  icon: typeof BarChart3;
  iconTint: 'green' | 'neutral';
  title: string;
  description: string;
  footer: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-terminal-border bg-terminal-black p-6 hover:border-terminal-green/40 transition-colors"
    >
      <div className="flex items-start justify-between mb-5">
        <div
          className={`w-12 h-12 flex items-center justify-center rounded-xl ${
            iconTint === 'green' ? 'bg-terminal-green/15' : 'bg-terminal-gray'
          }`}
        >
          <Icon
            className={`w-5 h-5 ${
              iconTint === 'green' ? 'text-terminal-green' : 'text-terminal-muted'
            }`}
          />
        </div>
        <ArrowRight className="w-5 h-5 text-terminal-muted group-hover:text-terminal-green group-hover:translate-x-0.5 transition-all" />
      </div>
      <h2 className="font-mono text-xl font-bold text-terminal-text mb-2">{title}</h2>
      <p className="font-sans text-sm text-terminal-muted leading-relaxed mb-5">{description}</p>
      <div className="pt-4 border-t border-terminal-border">{footer}</div>
    </Link>
  );
}

function ContributorsRow({
  contributors,
  activeToday,
  loading,
}: {
  contributors: number | undefined;
  activeToday: number | undefined;
  loading: boolean;
}) {
  // Legend-style chips — each dot + number tells a distinct story:
  // 7-day contributor base, today's active subset, nothing fabricated.
  // Skipped the avatar-stack approach because we don't actually have
  // per-user identity for the contributor aggregate.
  const isLoading = loading && contributors === undefined;

  return (
    <div className="flex items-center gap-4 font-mono text-xs">
      <LegendChip
        dot="bg-terminal-green"
        label="7-day"
        value={isLoading ? '—' : String(contributors ?? 0)}
      />
      <LegendChip
        dot="bg-terminal-cyan"
        label="today"
        value={isLoading ? '—' : String(activeToday ?? 0)}
      />
    </div>
  );
}

function LegendChip({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-terminal-muted">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span className="text-terminal-text font-semibold">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function MetaRow({
  total,
  lastUpdatedAt,
  loading,
}: {
  total: number | undefined;
  lastUpdatedAt: string | null;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="px-2.5 py-1 rounded-md bg-terminal-gray text-terminal-muted">
        {loading && total === undefined ? '—' : formatNumber(total ?? 0)} Entries
      </span>
      <span className="px-2.5 py-1 rounded-md bg-terminal-gray text-terminal-muted">
        Updated {timeAgo(lastUpdatedAt)}
      </span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  accentTone,
  loading,
  live = false,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  accent: string;
  accentTone: string;
  loading: boolean;
  /** Elevates the card visually — reserved for the single genuinely real-time metric. */
  live?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        live
          ? 'bg-terminal-black border-terminal-green/30 shadow-sm'
          : 'bg-terminal-gray border-terminal-border'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-terminal-muted">
          <Icon className="w-3.5 h-3.5 text-terminal-green" />
          {label}
        </div>
        {live && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`font-mono ${live ? 'text-4xl' : 'text-3xl'} font-bold text-terminal-text ${
            loading && value === '—' ? 'opacity-50' : ''
          }`}
          aria-live={live ? 'polite' : undefined}
        >
          {value}
        </span>
        <span className={`font-mono text-xs ${accentTone}`}>{accent}</span>
      </div>
    </div>
  );
}