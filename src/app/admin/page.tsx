'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  AppPage,
  PageHeader,
  Panel,
  KpiCard,
  formatCompact,
  formatDelta,
  deltaTone,
  timeAgo,
} from '@/components/app';

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

const POLL_INTERVAL_MS = 60_000;

const STATUS_COPY: Record<AdminOverview['systemStatus'], { label: string; tone: string; dot: string }> = {
  operational: { label: 'System active', tone: 'bg-terminal-green/15 text-terminal-green', dot: 'bg-terminal-green' },
  degraded:    { label: 'System degraded', tone: 'bg-terminal-amber/15 text-terminal-amber', dot: 'bg-terminal-amber' },
  down:        { label: 'System down', tone: 'bg-terminal-red/15 text-terminal-red', dot: 'bg-terminal-red' },
};

const LATENCY_TONE: Record<AdminOverview['latency']['verdict'], 'green' | 'amber' | 'red'> = {
  Optimal: 'green',
  Degraded: 'amber',
  Slow: 'red',
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
  const pending = loading && !overview;
  const dash = (v: string) => (pending ? '—' : v);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Platform / Admin"
        title="Admin panel"
        description="Platform health, knowledge-base state, and usage telemetry for the GovSecure deployment."
        actions={
          <>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs ${status.tone}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot} ${
                  overview?.systemStatus === 'operational' ? 'animate-pulse' : ''
                }`}
                aria-hidden="true"
              />
              {status.label}
            </span>
            <button
              onClick={() => fetchOverview()}
              disabled={refreshing}
              className="btn-secondary py-2 text-sm disabled:opacity-50"
              aria-label="Refresh overview"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {overview ? `Updated ${timeAgo(overview.generatedAt)}` : 'Refresh'}
            </button>
          </>
        }
      />

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 text-sm text-terminal-red">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </span>
          <button onClick={() => fetchOverview()} className="text-xs underline">
            Retry
          </button>
        </div>
      )}

      {/* ── KPI row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          tone="cyan"
          label="Embedding coverage"
          value={
            pending ? (
              '—'
            ) : (
              <>
                {overview?.compliance.score ?? 0}
                <span className="text-base text-terminal-muted">%</span>
              </>
            )
          }
          delta={overview ? formatDelta(overview.compliance.deltaPct) : undefined}
          deltaTone={deltaTone(overview?.compliance.deltaPct)}
          barPercent={overview?.compliance.score ?? 0}
          hint="Active KB entries with embeddings"
        />
        <KpiCard
          tone={overview && overview.knowledge.pending > 0 ? 'amber' : 'green'}
          label="Awaiting embedding"
          value={dash(String(overview?.knowledge.pending ?? 0))}
          delta={overview ? `of ${formatCompact(overview.knowledge.total)}` : undefined}
          deltaTone="muted"
          hint="Entries Govi cannot retrieve yet"
        />
        <KpiCard
          tone="green"
          label="Active sessions"
          value={dash(String(overview?.sessions.activeNow ?? 0))}
          delta={overview && overview.sessions.activeNow > 0 ? 'live' : undefined}
          hint="Distinct users in the last 15 min"
        />
        <KpiCard
          tone={overview && overview.errorRate24h > 5 ? 'red' : 'muted'}
          label="Error rate 24h"
          value={
            pending ? (
              '—'
            ) : (
              <>
                {overview?.errorRate24h ?? 0}
                <span className="text-base text-terminal-muted">%</span>
              </>
            )
          }
          hint="Share of logged events that failed"
        />
      </div>

      {/* ── Section links ──────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          href="/admin/analytics"
          icon={BarChart3}
          title="Analytics"
          description="Platform usage, AI throughput, and resource consumption across the deployment."
          stats={[
            { label: 'active today', value: dash(String(overview?.users.activeToday ?? 0)) },
            { label: 'contributors 7d', value: dash(String(overview?.users.contributorsLast7Days ?? 0)) },
            { label: 'total users', value: dash(formatCompact(overview?.users.total ?? 0)) },
          ]}
        />
        <SectionCard
          href="/admin/knowledge"
          icon={BookOpen}
          title="Knowledge base"
          description="Curate the governance entries and regulatory frameworks Govi retrieves from."
          stats={[
            { label: 'entries', value: dash(formatCompact(overview?.knowledge.total ?? 0)) },
            { label: 'embedded', value: dash(formatCompact(overview?.knowledge.embedded ?? 0)) },
            {
              label: 'last change',
              value: overview ? timeAgo(overview.knowledge.lastUpdatedAt) : '—',
            },
          ]}
        />
      </div>

      {/* ── Infrastructure readout ─────────────────────────────────── */}
      <Panel title="Infrastructure" padded>
        <dl className="grid gap-4 sm:grid-cols-3">
          <ReadoutRow
            label="Database round-trip"
            value={overview ? `${overview.latency.dbMs}ms` : '—'}
            note={overview?.latency.verdict ?? '—'}
            tone={overview ? LATENCY_TONE[overview.latency.verdict] : 'muted'}
          />
          <ReadoutRow
            label="Registered users"
            value={dash(formatCompact(overview?.users.total ?? 0))}
            note={overview ? `${overview.users.activeToday} active today` : '—'}
            tone="muted"
          />
          <ReadoutRow
            label="KB entries"
            value={dash(formatCompact(overview?.knowledge.total ?? 0))}
            note={overview ? `${overview.knowledge.embedded} embedded` : '—'}
            tone="muted"
          />
        </dl>
      </Panel>
    </AppPage>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function SectionCard({
  href,
  icon: Icon,
  title,
  description,
  stats,
}: {
  href: string;
  icon: typeof BarChart3;
  title: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
}) {
  return (
    <Link
      href={href}
      className="glass group flex flex-col rounded-xl p-4 transition-all duration-300 hover:-translate-y-px hover:border-terminal-green/40"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-xs font-bold tracking-wide text-terminal-text">
          <Icon className="h-4 w-4 text-terminal-green" aria-hidden="true" />
          {title}
        </span>
        <ArrowRight className="h-4 w-4 flex-none text-terminal-muted transition-transform group-hover:translate-x-0.5 group-hover:text-terminal-green" />
      </div>
      <p className="mb-4 flex-1 font-sans text-sm leading-relaxed text-terminal-muted">{description}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-terminal-border pt-3 font-mono text-xs">
        {stats.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-terminal-muted">
            <span className="font-semibold tabular-nums text-terminal-text">{s.value}</span>
            {s.label}
          </span>
        ))}
      </div>
    </Link>
  );
}

function ReadoutRow({
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
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-xl font-bold tabular-nums text-terminal-text">{value}</span>
        <span className={`font-mono text-xs ${toneClass}`}>{note}</span>
      </dd>
    </div>
  );
}
