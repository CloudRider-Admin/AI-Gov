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
  formatReview,
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
}

const POLL_MS = 30_000;

// Display metadata for the compliance posture rows — NIST first, by design.
const FRAMEWORK_META: Record<string, { short: string; hint: string; text: string; bar: string }> = {
  "NIST-AI-RMF": { short: "NIST AI RMF", hint: "US · default", text: "text-terminal-green", bar: "bg-terminal-green" },
  "ISO-42001": { short: "ISO/IEC 42001", hint: "international", text: "text-terminal-cyan", bar: "bg-terminal-cyan" },
  "EU-AI-Act": { short: "EU AI Act", hint: "if you operate in the EU", text: "text-terminal-muted", bar: "bg-terminal-muted" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 45) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function riskRating(level: string | null): { label: string; tone: string } {
  const v = (level ?? "").toLowerCase();
  if (v === "high" || v === "critical") return { label: "CRITICAL", tone: "bg-terminal-red/15 text-terminal-red" };
  if (v === "medium" || v === "moderate") return { label: "MEDIUM", tone: "bg-terminal-amber/15 text-terminal-amber" };
  if (v) return { label: "LOW", tone: "bg-terminal-green/15 text-terminal-green" };
  return { label: "NOMINAL", tone: "bg-terminal-gray text-terminal-muted" };
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
        riskRating(c.riskLevel).label,
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
                  {data?.recentConversations.map((c) => {
                    const risk = riskRating(c.riskLevel);
                    return (
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
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${risk.tone}`}
                          >
                            {risk.label}
                          </span>
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
                    );
                  })}
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
