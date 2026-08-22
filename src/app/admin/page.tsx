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
  embeddingCoverage: { score: number; deltaPct: number };
  latency: { dbMs: number; verdict: 'Optimal' | 'Degraded' | 'Slow' };
  sessions: { activeNow: number };
  errorRate24h: number;
}

interface AdminGovernance {
  generatedAt: string;
  estate: {
    total: number;
    archived: number;
    byRisk: Record<string, number>;
    byStage: Record<string, number>;
    byKind: Record<string, number>;
    awaitingApproval: number;
    overdueReview: number;
  };
  gateAging: Array<{
    systemId: string;
    systemName: string;
    gate: number;
    status: string;
    daysInGate: number;
    blockers: string[];
  }>;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    members: number;
    systems: number;
    lastSystemActivityAt: string | null;
  }>;
  ingest: {
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    tokensActive: number;
    tokensRevoked: number;
    lastIngestAt: string | null;
  };
  advisor: {
    total: number;
    confirmed: number;
    corrected: number;
    accuracyPct: number;
    topCorrections: Array<{ from: string; to: string; count: number }>;
  };
  workflows: {
    byStatus: Record<string, number>;
    stale: Array<{
      id: string;
      workflowType: string;
      currentStep: number;
      totalSteps: number;
      updatedAt: string;
    }>;
  };
}

const POLL_INTERVAL_MS = 60_000;

/** NIST impact tiers, in the order the register uses them. */
const RISK_ORDER: Array<{ key: string; label: string; tone: string }> = [
  { key: 'high', label: 'High', tone: 'text-terminal-red' },
  { key: 'moderate', label: 'Moderate', tone: 'text-terminal-amber' },
  { key: 'low', label: 'Low', tone: 'text-terminal-green' },
];

const STAGE_ORDER: Array<{ key: string; label: string }> = [
  { key: 'idea', label: 'Idea' },
  { key: 'piloting', label: 'Piloting' },
  { key: 'production', label: 'Production' },
  { key: 'retired', label: 'Retired' },
];

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
  const [governance, setGovernance] = useState<AdminGovernance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      // Fetched together but settled independently — a governance rollup failure
      // shouldn't blank out infrastructure health, or vice versa.
      const [overviewRes, governanceRes] = await Promise.allSettled([
        fetch('/api/admin/overview', { cache: 'no-store' }),
        fetch('/api/admin/governance', { cache: 'no-store' }),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        setOverview((await overviewRes.value.json()) as AdminOverview);
      } else {
        throw new Error('Failed to load overview');
      }

      if (governanceRes.status === 'fulfilled' && governanceRes.value.ok) {
        setGovernance((await governanceRes.value.json()) as AdminGovernance);
      }
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
        description="The governance estate across every tenant, plus platform health, knowledge-base state, and usage telemetry for the GovSecure deployment."
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
                {overview?.embeddingCoverage.score ?? 0}
                <span className="text-base text-terminal-muted">%</span>
              </>
            )
          }
          delta={overview ? formatDelta(overview.embeddingCoverage.deltaPct) : undefined}
          deltaTone={deltaTone(overview?.embeddingCoverage.deltaPct)}
          barPercent={overview?.embeddingCoverage.score ?? 0}
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

      {/* ── Governance estate ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          tone="green"
          label="Registered entities"
          value={governance ? formatCompact(governance.estate.total) : '—'}
          delta={governance && governance.estate.archived > 0 ? `${governance.estate.archived} archived` : undefined}
          deltaTone="muted"
          hint="Active systems, agents and use cases across all tenants"
        />
        <KpiCard
          tone="red"
          label="High impact"
          value={governance ? (governance.estate.byRisk.high ?? 0) : '—'}
          hint="NIST high-impact tier"
        />
        <KpiCard
          tone={governance && governance.estate.awaitingApproval > 0 ? 'amber' : 'muted'}
          label="Awaiting approval"
          value={governance ? governance.estate.awaitingApproval : '—'}
          hint="Sitting at Gate 3 without a decision"
        />
        <KpiCard
          tone={governance && governance.estate.overdueReview > 0 ? 'red' : 'green'}
          label="Overdue reviews"
          value={governance ? governance.estate.overdueReview : '—'}
          hint="Past their next scheduled review date"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Estate composition — risk and lifecycle in one readout */}
        <Panel title="Estate composition" padded>
          {!governance ? (
            <p className="py-8 text-center text-xs text-terminal-muted">No governance data.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  By impact tier
                </div>
                {RISK_ORDER.map((r) => {
                  const n = governance.estate.byRisk[r.key] ?? 0;
                  const pct = governance.estate.total ? Math.round((n / governance.estate.total) * 100) : 0;
                  return (
                    <div key={r.key} className="mb-2">
                      <div className="flex items-baseline justify-between font-mono text-xs">
                        <span className={r.tone}>{r.label}</span>
                        <span className="tabular-nums text-terminal-text">
                          {n} <span className="text-terminal-muted">· {pct}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-terminal-gray/40">
                        <div
                          className={`h-full ${r.key === 'high' ? 'bg-terminal-red' : r.key === 'moderate' ? 'bg-terminal-amber' : 'bg-terminal-green'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="mb-2 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  By lifecycle stage
                </div>
                {STAGE_ORDER.map((s) => (
                  <div key={s.key} className="flex items-baseline justify-between py-0.5 font-mono text-xs">
                    <span className="text-terminal-muted">{s.label}</span>
                    <span className="tabular-nums text-terminal-text">
                      {governance.estate.byStage[s.key] ?? 0}
                    </span>
                  </div>
                ))}
                <div className="mt-3 border-t border-terminal-border pt-2">
                  <div className="mb-1 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                    By kind
                  </div>
                  {Object.entries(governance.estate.byKind).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between py-0.5 font-mono text-xs">
                      <span className="text-terminal-muted">{k}</span>
                      <span className="tabular-nums text-terminal-text">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* Gate aging — the admin SLA view */}
        <Panel title="Gate aging" padded>
          {!governance ? (
            <p className="py-8 text-center text-xs text-terminal-muted">No governance data.</p>
          ) : governance.gateAging.length === 0 ? (
            <p className="py-8 text-center text-xs text-terminal-muted">
              No gates open. Nothing is waiting.
            </p>
          ) : (
            <ul className="divide-y divide-terminal-border/50">
              {governance.gateAging.map((g) => (
                <li key={`${g.systemId}-${g.gate}`} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-terminal-text">{g.systemName}</div>
                    <div className="font-mono text-xs text-terminal-muted">
                      Gate {g.gate} ·{' '}
                      <span className={g.status === 'failed' ? 'text-terminal-red' : 'text-terminal-amber'}>
                        {g.status}
                      </span>
                      {g.blockers.length > 0 && ` · ${g.blockers.length} blocker${g.blockers.length === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  <span
                    className={`flex-none font-mono text-xs tabular-nums ${
                      g.daysInGate >= 30
                        ? 'text-terminal-red'
                        : g.daysInGate >= 7
                          ? 'text-terminal-amber'
                          : 'text-terminal-muted'
                    }`}
                  >
                    {g.daysInGate}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Tenants ────────────────────────────────────────────────── */}
      <Panel title="Tenants">
        {!governance ? (
          <p className="px-6 py-8 text-center text-xs text-terminal-muted">No governance data.</p>
        ) : governance.tenants.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-terminal-muted">No organizations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-terminal-border font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  <th className="px-6 py-2 font-normal">Organization</th>
                  <th className="px-3 py-2 font-normal">Plan</th>
                  <th className="px-3 py-2 text-right font-normal">Members</th>
                  <th className="px-3 py-2 text-right font-normal">Systems</th>
                  <th className="px-6 py-2 text-right font-normal">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {governance.tenants.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-terminal-border/50 transition-colors last:border-b-0 hover:bg-terminal-gray/20"
                  >
                    <td className="px-6 py-2">
                      <div className="font-sans text-xs text-terminal-text">{t.name}</div>
                      <div className="font-mono text-xs text-terminal-muted">{t.slug}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-terminal-muted">{t.plan}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-terminal-text">
                      {t.members}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-terminal-text">
                      {t.systems}
                    </td>
                    <td className="px-6 py-2 text-right font-mono text-xs text-terminal-muted">
                      {timeAgo(t.lastSystemActivityAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Ingest health · advisor quality · workflows ─────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel title="Evaluation ingest" padded>
          {!governance ? (
            <p className="py-8 text-center text-xs text-terminal-muted">—</p>
          ) : (
            <>
              <div className="mb-2 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                By source
              </div>
              {['upload', 'manual', 'api'].map((s) => (
                <div key={s} className="flex items-baseline justify-between py-0.5 font-mono text-xs">
                  <span className="text-terminal-muted">{s}</span>
                  <span className="tabular-nums text-terminal-text">{governance.ingest.bySource[s] ?? 0}</span>
                </div>
              ))}
              <div className="mt-3 border-t border-terminal-border pt-2">
                <div className="mb-1 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  By status
                </div>
                {['draft', 'ingested', 'reviewed'].map((s) => (
                  <div key={s} className="flex items-baseline justify-between py-0.5 font-mono text-xs">
                    <span className="text-terminal-muted">{s}</span>
                    <span className="tabular-nums text-terminal-text">{governance.ingest.byStatus[s] ?? 0}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-terminal-border pt-2 font-mono text-xs text-terminal-muted">
                <div className="flex items-baseline justify-between py-0.5">
                  <span>Ingest tokens</span>
                  <span className="tabular-nums text-terminal-text">
                    {governance.ingest.tokensActive} active
                    {governance.ingest.tokensRevoked > 0 && ` · ${governance.ingest.tokensRevoked} revoked`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between py-0.5">
                  <span>Last ingest</span>
                  <span className="text-terminal-text">{timeAgo(governance.ingest.lastIngestAt)}</span>
                </div>
              </div>
            </>
          )}
        </Panel>

        <Panel title="Advisor intent quality" padded>
          {!governance ? (
            <p className="py-8 text-center text-xs text-terminal-muted">—</p>
          ) : governance.advisor.total === 0 ? (
            <p className="py-8 text-center text-xs text-terminal-muted">No intent feedback collected yet.</p>
          ) : (
            <>
              <div className="font-mono text-3xl tabular-nums text-terminal-green">
                {governance.advisor.accuracyPct}
                <span className="text-base text-terminal-muted">%</span>
              </div>
              <p className="font-sans text-xs text-terminal-muted">
                {governance.advisor.confirmed} confirmed of {governance.advisor.total} classified
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-terminal-gray/30">
                <div
                  className="h-full bg-terminal-green"
                  style={{ width: `${governance.advisor.accuracyPct}%` }}
                />
              </div>
              {governance.advisor.topCorrections.length > 0 && (
                <div className="mt-3 border-t border-terminal-border pt-2">
                  <div className="mb-1 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                    Most corrected
                  </div>
                  {governance.advisor.topCorrections.map((c, i) => (
                    <div key={i} className="flex items-baseline justify-between py-0.5 font-mono text-xs">
                      <span className="truncate text-terminal-muted">
                        {c.from} <span className="text-terminal-amber">→</span> {c.to}
                      </span>
                      <span className="flex-none tabular-nums text-terminal-text">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel title="Workflows in flight" padded>
          {!governance ? (
            <p className="py-8 text-center text-xs text-terminal-muted">—</p>
          ) : (
            <>
              {['in-progress', 'paused', 'completed', 'abandoned'].map((s) => (
                <div key={s} className="flex items-baseline justify-between py-0.5 font-mono text-xs">
                  <span className="text-terminal-muted">{s}</span>
                  <span className="tabular-nums text-terminal-text">
                    {governance.workflows.byStatus[s] ?? 0}
                  </span>
                </div>
              ))}
              <div className="mt-3 border-t border-terminal-border pt-2">
                <div className="mb-1 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  Stale · untouched 7d+
                </div>
                {governance.workflows.stale.length === 0 ? (
                  <p className="py-2 font-sans text-xs text-terminal-muted">None stalled.</p>
                ) : (
                  governance.workflows.stale.map((w) => (
                    <div key={w.id} className="flex items-baseline justify-between py-0.5 font-mono text-xs">
                      <span className="truncate text-terminal-muted">
                        {w.workflowType} · {w.currentStep}/{w.totalSteps}
                      </span>
                      <span className="flex-none text-terminal-amber">{timeAgo(w.updatedAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </Panel>
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
