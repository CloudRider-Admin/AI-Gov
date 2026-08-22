import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import {
  getAuditPage,
  getAuditActions,
  AUDIT_PAGE_SIZE,
  type AuditQuery,
  type AuditOutcome,
} from '@/lib/audit';
import { FileClock, Download, Globe, User } from 'lucide-react';
import { AppPage, PageHeader, Panel } from '@/components/app';

export const metadata: Metadata = {
  title: 'Audit Trail',
  description: 'Append-only record of governance actions across your workspace.',
};

const ACTION_LABELS: Record<string, string> = {
  'ai_system.created': 'System registered',
  'ai_system.updated': 'System updated',
  'ai_system.archived': 'System archived',
  'ai_system.approved': 'System approved',
  'ai_system.rejected': 'System rejected',
  'ai_system.approval_withdrawn': 'Approval withdrawn',
  'ai_system.approval_reset': 'Approval reset',
  'control.updated': 'Control updated',
  'task.created': 'Task created',
  'task.completed': 'Task completed',
  'artifact.approved': 'Artifact approved',
  'gate.status_changed': 'Gate moved',
  'gate.waived': 'Gate waived',
  'gate.waiver_lapsed': 'Waiver expired',
  'evaluation.reviewed': 'Evidence reviewed',
  'auth.signed_in': 'Signed in',
  'auth.signed_out': 'Signed out',
  'auth.login_failed': 'Sign-in failed',
  'auth.login_blocked': 'Sign-in blocked',
  'auth.email_unverified': 'Sign-in refused',
  'auth.role_changed': 'Role changed',
};

const OUTCOME_STYLES: Record<AuditOutcome, string> = {
  success: 'text-terminal-green border-terminal-green/40',
  failure: 'text-terminal-red border-terminal-red/40',
  denied: 'text-terminal-amber border-terminal-amber/40',
};

const OUTCOMES: AuditOutcome[] = ['success', 'failure', 'denied'];

const RANGES: { value: string; label: string; days: number | null }[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length > 0 ? v : undefined;
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const params = await searchParams;

  // The trail is the organization's, not the individual's — an auditor needs to
  // see what everyone did, not what the person logged in happened to do.
  // Falls back to the personal trail for users who are not in an organization.
  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true, organization: { select: { name: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  const scope: Pick<AuditQuery, 'organizationId' | 'actorId'> = membership
    ? { organizationId: membership.organizationId }
    : { actorId: session.user.id };

  const page = Math.max(Number(one(params.page) ?? '1') || 1, 1);
  const action = one(params.action);
  const outcomeParam = one(params.outcome);
  const outcome = OUTCOMES.includes(outcomeParam as AuditOutcome)
    ? (outcomeParam as AuditOutcome)
    : undefined;
  const search = one(params.q);
  const rangeValue = one(params.range) ?? '30d';
  const range = RANGES.find((r) => r.value === rangeValue) ?? RANGES[1];
  const from = range.days ? new Date(Date.now() - range.days * 86_400_000) : undefined;

  const filter: AuditQuery = { ...scope, action, outcome, search, from };

  const [result, actions] = await Promise.all([
    getAuditPage(filter, page, AUDIT_PAGE_SIZE),
    getAuditActions(scope),
  ]);

  const exportQuery = new URLSearchParams();
  if (action) exportQuery.set('action', action);
  if (outcome) exportQuery.set('outcome', outcome);
  if (search) exportQuery.set('q', search);
  exportQuery.set('range', range.value);

  const pageHref = (n: number) => {
    const q = new URLSearchParams(exportQuery);
    q.set('page', String(n));
    return `/audit?${q.toString()}`;
  };

  const hasFilters = Boolean(action || outcome || search) || range.value !== '30d';

  return (
    <AppPage width="max-w-5xl">
      <PageHeader
        eyebrow="Governance / Audit"
        title="Audit Trail"
        description="An append-only, timestamped record of every governance action — the evidence auditors ask for, generated automatically."
        actions={
          <a
            href={`/api/audit/export?${exportQuery.toString()}`}
            className="btn-secondary text-xs py-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex items-center gap-2 font-mono text-xs text-terminal-muted">
        {membership ? (
          <>
            <Globe className="w-3.5 h-3.5" />
            <span>
              Showing every action across{' '}
              <span className="text-terminal-text">{membership.organization.name}</span>
            </span>
          </>
        ) : (
          <>
            <User className="w-3.5 h-3.5" />
            <span>
              Showing your own actions. Create a workspace to keep a shared, org-wide trail.
            </span>
          </>
        )}
      </div>

      {/* Filters — a GET form so every view is a shareable, bookmarkable URL. */}
      <form method="GET" action="/audit" className="glass rounded-xl p-4 mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={search ?? ''}
              placeholder="Find in summaries…"
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Action</span>
            <select name="action" defaultValue={action ?? ''} className="input-field">
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a.action} value={a.action}>
                  {ACTION_LABELS[a.action] ?? a.action} ({a.count})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Outcome</span>
            <select name="outcome" defaultValue={outcome ?? ''} className="input-field">
              <option value="">Any outcome</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o[0].toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Period</span>
            <select name="range" defaultValue={range.value} className="input-field">
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="btn-primary text-xs py-1.5">
            Apply filters
          </button>
          {hasFilters && (
            <Link href="/audit" className="btn-secondary text-xs py-1.5">
              Clear
            </Link>
          )}
        </div>
      </form>

      {result.total === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <FileClock className="w-10 h-10 text-terminal-muted mx-auto mb-4" aria-hidden="true" />
          <p className="font-mono text-terminal-text mb-1">
            {hasFilters ? 'No events match these filters' : 'No activity yet'}
          </p>
          <p className="text-terminal-muted text-sm">
            {hasFilters
              ? 'Widen the period or clear the filters to see the full trail.'
              : 'Actions across the inventory, compliance, and tasks views will appear here.'}
          </p>
        </div>
      ) : (
        <Panel
          title="Activity log"
          action={
            <span className="font-normal text-terminal-muted tabular-nums">
              {result.total.toLocaleString()} event{result.total === 1 ? '' : 's'}
              {result.pageCount > 1 ? ` · page ${result.page} of ${result.pageCount}` : ''}
            </span>
          }
        >
          <div className="divide-y divide-terminal-border/50">
            {result.entries.map((e) => {
              const outcomeStyle =
                OUTCOME_STYLES[(e.outcome as AuditOutcome) ?? 'success'] ?? OUTCOME_STYLES.success;
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                      e.outcome === 'failure'
                        ? 'bg-terminal-red'
                        : e.outcome === 'denied'
                          ? 'bg-terminal-amber'
                          : 'bg-terminal-green'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-terminal-green uppercase tracking-wider">
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                      <span className="rounded-md border border-terminal-border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                        {e.entityType}
                      </span>
                      {e.outcome !== 'success' && (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider ${outcomeStyle}`}
                        >
                          {e.outcome}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-terminal-text mt-0.5">{e.summary}</p>
                    {e.actorIp && (
                      <p className="mt-1 font-mono text-[11px] text-terminal-muted">
                        from {e.actorIp}
                      </p>
                    )}
                  </div>
                  <time
                    dateTime={new Date(e.createdAt).toISOString()}
                    className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-terminal-muted"
                  >
                    {new Date(e.createdAt).toLocaleString()}
                  </time>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {result.pageCount > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-3"
          aria-label="Audit trail pagination"
        >
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="btn-secondary text-xs py-1.5">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-xs text-terminal-muted tabular-nums">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} className="btn-secondary text-xs py-1.5">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </AppPage>
  );
}
