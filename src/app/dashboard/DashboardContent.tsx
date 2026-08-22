"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Download,
  Plus,
  Server,
} from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import {
  AppPage,
  PageHeader,
  Panel,
  PanelLink,
  KpiCard,
  RiskPill,
  StagePill,
  SeverityPill,
  severityLabel,
  formatReview,
  timeAgo,
} from "@/components/app";
import { RolePriorities } from "./RolePriorities";

interface RecentConversation {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  riskLevel: string | null;
}

interface AuditEvent {
  id: string;
  createdAt: string;
  event: string;
  category: string;
  tone: "info" | "warn" | "error" | "success";
  summary: string;
}

interface SystemPreview {
  id: string;
  name: string;
  vendor: string | null;
  model: string | null;
  riskCategory: string;
  lifecycleStage: string;
  nextReviewAt: string | null;
}

interface GovernanceSnapshot {
  inventory: { total: number; high: number; overdue: number };
  deltas: { systems7d: number; high7d: number };
  systemsTrend: number[];
  highTrend: number[];
  overdueTrend: number[];
  systems: SystemPreview[];
  frameworks: { id: string; name: string; coverage: number }[];
  averageCoverage: number;
  maturityScore: number;
  auditEventsToday: number;
}

interface GateBlocker {
  id: string;
  name: string;
  gate: number;
  riskCategory: string;
  blockers: string[];
}

interface GatePipeline {
  total: number;
  atGate1: number;
  atGate2: number;
  atGate3: number;
  cleared: number;
  blocked: number;
  awaitingApproval: number;
  blockedEntities: GateBlocker[];
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  framework: string | null;
  aiSystemId: string | null;
}

interface RemediationQueue {
  open: number;
  overdue: number;
  dueSoon: number;
  byPriority: { critical: number; high: number; medium: number; low: number };
  items: TaskItem[];
}

interface RegulatoryItem {
  id: string;
  title: string;
  summary: string;
  jurisdiction: string;
  framework: string | null;
  severity: string;
  url: string | null;
  publishedAt: string;
}

interface EvaluationCoverage {
  highRiskTotal: number;
  highRiskCovered: number;
  percent: number;
}

interface TokenBudgetSnapshot {
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
}

interface DashboardData {
  stats: {
    conversations: number;
    messagesAnalyzed: number;
    riskFlags: number;
    plan: string;
  };
  memberSince: string | null;
  onboardingCompleted: boolean;
  occupationalRole: string | null;
  recentConversations: RecentConversation[];
  systemStatus: "nominal" | "degraded" | "offline";
  recentEvents: AuditEvent[];
  governance: GovernanceSnapshot;
  gates: GatePipeline;
  remediation: RemediationQueue;
  regulatory: RegulatoryItem[];
  maturityTrend: number[];
  evaluationCoverage: EvaluationCoverage;
  tokenBudget: TokenBudgetSnapshot;
}

/** Gate labels — the register's three stages, in order. */
const GATE_META: Array<{ gate: number; label: string; hint: string; tone: "green" | "cyan" | "amber" }> = [
  { gate: 1, label: "Intake", hint: "risk tiering", tone: "green" },
  { gate: 2, label: "Evaluation", hint: "evidence & review", tone: "cyan" },
  { gate: 3, label: "Approval", hint: "sign-off", tone: "amber" },
];

const PRIORITY_STYLE: Record<string, string> = {
  critical: "text-terminal-red",
  high: "text-terminal-red",
  medium: "text-terminal-amber",
  low: "text-terminal-muted",
};

const JURISDICTION_STYLE: Record<string, string> = {
  EU: "text-terminal-cyan",
  "US-Federal": "text-terminal-green",
  "US-CA": "text-terminal-green",
  UK: "text-terminal-amber",
  Global: "text-terminal-muted",
};

const POLL_MS = 30_000;

// Display metadata for the compliance posture rows — NIST first, by design.
const FRAMEWORK_META: Record<string, { short: string; hint: string; text: string; bar: string }> = {
  "NIST-AI-RMF": { short: "NIST AI RMF", hint: "US · default", text: "text-terminal-green", bar: "bg-terminal-green" },
  "ISO-42001": { short: "ISO/IEC 42001", hint: "international", text: "text-terminal-cyan", bar: "bg-terminal-cyan" },
  "EU-AI-Act": { short: "EU AI Act", hint: "if you operate in the EU", text: "text-terminal-muted", bar: "bg-terminal-muted" },
};

function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function DashboardContent() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  // Once the wizard is completed/skipped this session, stale poll responses
  // (fetched before the POST committed) must not re-open it.
  const wizardDismissedRef = useRef(false);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      if (!r.ok) throw new Error(`Failed to load dashboard (${r.status})`);
      const d: DashboardData = await r.json();
      setData(d);
      if (d.onboardingCompleted === false && !wizardDismissedRef.current) setShowWizard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(() => fetchDashboard(true), POLL_MS);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  const statusCopy = useMemo(() => {
    const s = data?.systemStatus ?? "nominal";
    if (s === "offline") return { label: "OFFLINE", tone: "text-terminal-red" };
    if (s === "degraded") return { label: "DEGRADED", tone: "text-terminal-amber" };
    return { label: "NOMINAL", tone: "text-terminal-green" };
  }, [data?.systemStatus]);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const gov = data?.governance;
  const gates = data?.gates;
  const remediation = data?.remediation;
  const nistCoverage = gov?.frameworks.find((f) => f.id === "NIST-AI-RMF")?.coverage ?? null;
  const pending = loading && !data;

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Session ID", "Title", "Messages", "Risk", "Updated"],
      ...data.recentConversations.map((c) => [
        c.id.slice(0, 8),
        c.title.replace(/"/g, '""'),
        String(c.messageCount),
        severityLabel(c.riskLevel),
        c.updatedAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppPage>
      {showWizard && (
        <OnboardingWizard
          onComplete={() => {
            wizardDismissedRef.current = true;
            setShowWizard(false);
            setData((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
          }}
        />
      )}

      <PageHeader
        eyebrow="AI Governance / Overview"
        title="Dashboard"
        description="Your governance program at a glance — coverage, risk exposure, and what needs attention this week."
        actions={
          <>
            <Link href="/inventory" className="btn-secondary text-sm py-2">
              <Plus className="w-4 h-4" /> New AI system
            </Link>
            <Link href="/govi" className="btn-primary text-sm py-2">
              <MessageSquare className="w-4 h-4" /> Ask Govi
            </Link>
          </>
        }
      />

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 text-sm text-terminal-red">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
          <button onClick={() => fetchDashboard()} className="text-xs underline">
            Retry
          </button>
        </div>
      )}

      {/* ── KPI row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          tone="green"
          label="AI systems"
          value={pending ? "—" : gov?.inventory.total ?? 0}
          delta={gov && gov.deltas.systems7d > 0 ? `+${gov.deltas.systems7d}` : undefined}
          trend={gov?.systemsTrend}
        />
        <KpiCard
          tone="red"
          label="High impact"
          value={pending ? "—" : gov?.inventory.high ?? 0}
          delta={gov && gov.deltas.high7d > 0 ? `+${gov.deltas.high7d}` : undefined}
          trend={gov?.highTrend}
        />
        <KpiCard
          tone="cyan"
          label="Control coverage"
          value={
            pending ? (
              "—"
            ) : (
              <>
                {gov?.averageCoverage ?? 0}
                <span className="text-base text-terminal-muted">%</span>
              </>
            )
          }
          barPercent={gov?.averageCoverage ?? 0}
        />
        <KpiCard
          tone="amber"
          label="Overdue reviews"
          value={pending ? "—" : gov?.inventory.overdue ?? 0}
          delta={gov && gov.inventory.overdue > 0 ? "due" : undefined}
          trend={gov?.overdueTrend}
        />
      </div>

      {/* ── Secondary KPI row ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          tone="cyan"
          label="Maturity score"
          value={pending ? "—" : gov?.maturityScore ?? 0}
          hint="composite across inventory, controls, cadence, remediation"
          trend={data?.maturityTrend?.length ? data.maturityTrend : undefined}
        />
        <KpiCard
          tone={
            !data?.evaluationCoverage.highRiskTotal
              ? "muted"
              : data.evaluationCoverage.percent >= 80
                ? "green"
                : data.evaluationCoverage.percent >= 50
                  ? "amber"
                  : "red"
          }
          label="Evaluation coverage"
          value={
            pending ? (
              "—"
            ) : (
              <>
                {data?.evaluationCoverage.percent ?? 0}
                <span className="text-base text-terminal-muted">%</span>
              </>
            )
          }
          hint={
            data
              ? `${data.evaluationCoverage.highRiskCovered}/${data.evaluationCoverage.highRiskTotal} high-impact systems with a passing run`
              : undefined
          }
          barPercent={data?.evaluationCoverage.percent ?? 0}
        />
        <KpiCard
          tone={remediation && remediation.overdue > 0 ? "red" : "green"}
          label="Open remediation"
          value={pending ? "—" : remediation?.open ?? 0}
          delta={remediation && remediation.overdue > 0 ? `${remediation.overdue} overdue` : undefined}
          deltaTone="red"
          hint="tasks you own or are assigned"
        />
        <KpiCard
          tone="green"
          label="Token budget"
          value={
            pending ? (
              "—"
            ) : data?.tokenBudget.limit == null ? (
              "Unlimited"
            ) : (
              <>
                {data.tokenBudget.percent}
                <span className="text-base text-terminal-muted">%</span>
              </>
            )
          }
          hint={
            !data
              ? undefined
              : data.tokenBudget.limit == null
                ? `${data.tokenBudget.used.toLocaleString()} tokens this month`
                : `${data.tokenBudget.used.toLocaleString()} / ${data.tokenBudget.limit.toLocaleString()} this month`
          }
          barPercent={data && data.tokenBudget.limit != null ? data.tokenBudget.percent : undefined}
        />
      </div>

      {/* ── Gate pipeline + remediation queue ──────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Governance gate pipeline"
          action={<PanelLink href="/gates">Open board</PanelLink>}
          padded
        >
          {pending ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-terminal-muted" />
            </div>
          ) : !gates || gates.total === 0 ? (
            <p className="py-8 text-center text-xs text-terminal-muted">
              No entities in the register yet.{" "}
              <Link href="/intake" className="text-terminal-green underline">
                Run intake
              </Link>{" "}
              to open Gate 1.
            </p>
          ) : (
            <>
              {/* Funnel — how many entities sit at each gate */}
              <div className="grid grid-cols-4 gap-2">
                {GATE_META.map((g) => {
                  const count =
                    g.gate === 1 ? gates.atGate1 : g.gate === 2 ? gates.atGate2 : gates.atGate3;
                  const pct = gates.total ? Math.round((count / gates.total) * 100) : 0;
                  return (
                    <div key={g.gate} className="rounded-md border border-terminal-border bg-terminal-gray/20 p-3">
                      <div className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
                        Gate {g.gate}
                      </div>
                      <div className="mt-1 font-mono text-2xl tabular-nums text-terminal-text">{count}</div>
                      <div className="font-sans text-xs text-terminal-muted">
                        {g.label} · {g.hint}
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-terminal-gray/40">
                        <div
                          className={`h-full ${g.tone === "green" ? "bg-terminal-green" : g.tone === "cyan" ? "bg-terminal-cyan" : "bg-terminal-amber"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-md border border-terminal-green/40 bg-terminal-green/5 p-3">
                  <div className="font-mono text-xs uppercase tracking-wider text-terminal-muted">Cleared</div>
                  <div className="mt-1 font-mono text-2xl tabular-nums text-terminal-green">{gates.cleared}</div>
                  <div className="font-sans text-xs text-terminal-muted">all gates passed</div>
                </div>
              </div>

              {/* Counters that need action */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-terminal-border pt-3 font-mono text-xs">
                <span className="text-terminal-muted">
                  Blocked <span className="tabular-nums text-terminal-red">{gates.blocked}</span>
                </span>
                <span className="text-terminal-muted">
                  Awaiting approval{" "}
                  <span className="tabular-nums text-terminal-amber">{gates.awaitingApproval}</span>
                </span>
                <span className="text-terminal-muted">
                  In register <span className="tabular-nums text-terminal-text">{gates.total}</span>
                </span>
              </div>

              {/* The actionable part: what is actually blocking each stuck entity */}
              {gates.blockedEntities.length > 0 && (
                <div className="mt-3 space-y-2">
                  {gates.blockedEntities.map((e) => (
                    <Link
                      key={e.id}
                      href={`/gates/${e.id}`}
                      className="block rounded-md border border-terminal-red/30 bg-terminal-red/5 p-3 transition-colors hover:border-terminal-red/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-xs text-terminal-text">{e.name}</span>
                        <span className="flex-none font-mono text-xs text-terminal-red">
                          Gate {e.gate} failed
                        </span>
                      </div>
                      {e.blockers.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {e.blockers.slice(0, 3).map((b, i) => (
                            <li key={i} className="font-sans text-xs text-terminal-muted">
                              — {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Remediation queue"
          action={<PanelLink href="/tasks">All tasks</PanelLink>}
          padded
        >
          {pending ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-terminal-muted" />
            </div>
          ) : !remediation || remediation.open === 0 ? (
            <p className="py-8 text-center text-xs text-terminal-muted">Nothing open. Queue is clear.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-4 font-mono">
                <div>
                  <div className="text-2xl tabular-nums text-terminal-text">{remediation.open}</div>
                  <div className="text-xs text-terminal-muted">open</div>
                </div>
                <div>
                  <div className="text-2xl tabular-nums text-terminal-red">{remediation.overdue}</div>
                  <div className="text-xs text-terminal-muted">overdue</div>
                </div>
                <div>
                  <div className="text-2xl tabular-nums text-terminal-amber">{remediation.dueSoon}</div>
                  <div className="text-xs text-terminal-muted">due ≤7d</div>
                </div>
              </div>

              <ul className="mt-3 divide-y divide-terminal-border/50 border-t border-terminal-border">
                {remediation.items.map((t) => {
                  const due = formatReview(t.dueDate);
                  return (
                    <li key={t.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-sans text-xs text-terminal-text">{t.title}</div>
                        <div className="font-mono text-xs text-terminal-muted">
                          <span className={PRIORITY_STYLE[t.priority] ?? "text-terminal-muted"}>
                            {t.priority}
                          </span>
                          {t.framework && ` · ${t.framework}`}
                        </div>
                      </div>
                      <span
                        className={`flex-none font-mono text-xs ${due.overdue ? "text-terminal-red" : "text-terminal-muted"}`}
                      >
                        {t.dueDate ? due.text : "no date"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>
      </div>

      {/* ── Inventory preview + compliance / priorities ────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.9fr_1fr]">
        <Panel
          title="AI system inventory"
          action={<PanelLink href="/inventory">View all {gov?.inventory.total ?? 0}</PanelLink>}
        >
          {pending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-terminal-muted" />
            </div>
          ) : !gov || gov.systems.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Server className="mx-auto mb-4 h-10 w-10 text-terminal-muted" />
              <p className="mb-2 font-mono text-terminal-text">No AI systems registered yet</p>
              <p className="mb-6 text-sm text-terminal-muted">
                Start your register by adding the AI tools and models your team uses.
              </p>
              <Link href="/inventory" className="btn-primary text-sm py-2">
                <Plus className="w-4 h-4" /> Register your first system
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-terminal-border bg-terminal-gray/30 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                    <th className="px-4 py-2.5 font-semibold">System</th>
                    <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Vendor</th>
                    <th className="px-4 py-2.5 font-semibold">Risk</th>
                    <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Lifecycle</th>
                    <th className="px-4 py-2.5 font-semibold hidden lg:table-cell">Next review</th>
                  </tr>
                </thead>
                <tbody>
                  {gov.systems.map((s) => {
                    const review = formatReview(s.nextReviewAt);
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-terminal-border/50 transition-colors duration-300 last:border-b-0 hover:bg-terminal-gray/30"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-terminal-text">{s.name}</div>
                          {s.model && (
                            <div className="font-mono text-xs text-terminal-muted">{s.model}</div>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-terminal-muted md:table-cell">
                          {s.vendor || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <RiskPill risk={s.riskCategory} />
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <StagePill stage={s.lifecycleStage} />
                        </td>
                        <td
                          className={`hidden px-4 py-3 font-mono text-xs tabular-nums lg:table-cell ${
                            review.overdue ? "text-terminal-amber" : "text-terminal-muted"
                          }`}
                        >
                          {review.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Compliance posture" action={<PanelLink href="/compliance">Open</PanelLink>} padded>
            <div className="flex flex-col gap-4">
              {(gov?.frameworks ?? Object.keys(FRAMEWORK_META).map((id) => ({ id, name: id, coverage: 0 }))).map(
                (fw) => {
                  const meta = FRAMEWORK_META[fw.id] ?? {
                    short: fw.name,
                    hint: "",
                    text: "text-terminal-muted",
                    bar: "bg-terminal-muted",
                  };
                  return (
                    <div key={fw.id}>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-terminal-text">
                          {meta.short}
                          {meta.hint && (
                            <span className="ml-2 font-mono text-xs font-normal text-terminal-muted">
                              {meta.hint}
                            </span>
                          )}
                        </span>
                        <span className={`font-mono text-sm font-bold tabular-nums ${meta.text}`}>
                          {pending ? "—" : `${fw.coverage}%`}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-terminal-gray/30">
                        <div
                          className={`h-full rounded-full ${meta.bar}`}
                          style={{ width: `${Math.min(100, Math.max(0, fw.coverage))}%` }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </Panel>

          <RolePriorities
            role={data?.occupationalRole ?? null}
            stats={{
              maturityScore: gov?.maturityScore ?? null,
              nistCoverage,
              auditEventsToday: gov?.auditEventsToday ?? null,
              inventoryTotal: gov?.inventory.total ?? null,
            }}
          />
        </div>
      </div>

      {/* ── Regulatory horizon ─────────────────────────────────── */}
      <Panel
        title="Regulatory horizon"
        action={<span className="font-mono text-xs text-terminal-muted">{data?.regulatory.length ?? 0} tracked</span>}
      >
        {pending ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-terminal-muted" />
          </div>
        ) : !data || data.regulatory.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-terminal-muted">No regulatory updates tracked.</p>
        ) : (
          <ul className="divide-y divide-terminal-border/50">
            {data.regulatory.map((r) => {
              const row = (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex-none font-mono text-xs ${JURISDICTION_STYLE[r.jurisdiction] ?? "text-terminal-muted"}`}
                    >
                      {r.jurisdiction}
                    </span>
                    <SeverityPill level={r.severity === "notable" ? "medium" : r.severity === "info" ? "low" : r.severity} />
                    {r.framework && (
                      <span className="font-mono text-xs text-terminal-muted">{r.framework}</span>
                    )}
                    <span className="ml-auto flex-none font-mono text-xs text-terminal-muted">
                      {new Date(r.publishedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="mt-1 font-sans text-xs text-terminal-text">{r.title}</div>
                  <p className="mt-0.5 line-clamp-2 font-sans text-xs text-terminal-muted">{r.summary}</p>
                </>
              );
              return (
                <li key={r.id} className="px-6 py-3 transition-colors hover:bg-terminal-gray/20">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="block">
                      {row}
                    </a>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── Recent Govi sessions + live audit trail ────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.9fr_1fr]">
        <Panel
          title="Recent Govi sessions"
          action={
            <button
              onClick={exportCsv}
              disabled={!data?.recentConversations.length}
              className="inline-flex items-center gap-1 text-terminal-green hover:underline disabled:opacity-50"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          }
        >
          {pending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-terminal-muted" />
            </div>
          ) : data?.recentConversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 text-terminal-muted" />
              <p className="mb-4 text-sm text-terminal-muted">
                No sessions yet. Start a conversation with the AI Advisor.
              </p>
              <Link href="/govi" className="btn-primary text-sm py-2">
                Start your first session <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-terminal-border bg-terminal-gray/30 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                    <th className="px-4 py-2.5 font-semibold">Session</th>
                    <th className="px-4 py-2.5 font-semibold">Risk rating</th>
                    <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Updated</th>
                    <th className="w-8 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data?.recentConversations.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-terminal-border/50 transition-colors duration-300 last:border-b-0 hover:bg-terminal-gray/30"
                    >
                      <td className="px-4 py-3">
                        <div className="max-w-[260px] truncate font-medium text-terminal-text">
                          {c.title}
                        </div>
                        <div className="font-mono text-xs text-terminal-muted">
                          #{c.id.slice(0, 8)} · {c.messageCount} messages
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <SeverityPill level={c.riskLevel} />
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-terminal-muted sm:table-cell">
                        {timeAgo(c.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/govi?c=${c.id}`}
                          className="text-terminal-muted hover:text-terminal-green"
                          aria-label={`Open session ${c.title}`}
                        >
                          <ArrowRight className="inline h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terminal-green" aria-hidden="true" />
              Live audit trail
            </span>
          }
          action={<PanelLink href="/audit">Open</PanelLink>}
          padded
        >
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {data?.recentEvents?.length ? (
              data.recentEvents.map((e) => <AuditLine key={e.id} event={e} />)
            ) : (
              <p className="text-xs text-terminal-muted">
                No audit events yet. Activity will appear here.
              </p>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Footer strip ───────────────────────────────────────── */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 font-mono text-xs uppercase tracking-wider text-terminal-muted">
          <span>
            Welcome back, {firstName} · Plan {data.stats.plan} ·{" "}
            <span className={statusCopy.tone}>System {statusCopy.label}</span>
          </span>
          {data.memberSince && (
            <span>
              Member since{" "}
              {new Date(data.memberSince).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      )}
    </AppPage>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function AuditLine({ event }: { event: AuditEvent }) {
  const tone =
    event.tone === "error"
      ? "text-terminal-red"
      : event.tone === "warn"
      ? "text-terminal-amber"
      : event.tone === "success"
      ? "text-terminal-green"
      : "text-terminal-text";
  return (
    <div className="flex gap-2 font-mono text-xs leading-relaxed">
      <span className="shrink-0 text-terminal-muted">[{formatClock(event.createdAt)}]</span>
      <span className={tone}>{event.summary}</span>
    </div>
  );
}
