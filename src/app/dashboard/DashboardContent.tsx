"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Loader2,
  Download,
  Plus,
  Server,
  CalendarClock,
  ShieldAlert,
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  Activity,
  XCircle,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import {
  AppPage,
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
const FRAMEWORK_META: Record<string, { short: string; hint: string; bar: string }> = {
  "NIST-AI-RMF": { short: "NIST AI RMF", hint: "US · default", bar: "bg-terminal-green" },
  "ISO-42001": { short: "ISO/IEC 42001", hint: "International", bar: "bg-terminal-cyan" },
  "EU-AI-Act": { short: "EU AI Act", hint: "If you operate in the EU", bar: "bg-terminal-amber" },
};

const GOVI_SUGGESTIONS = [
  "Assess a new AI use case",
  "Draft an AI acceptable use policy",
  "What does the EU AI Act require of us?",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (t === startToday) return "Today";
  if (t === startToday - 86_400_000) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sentenceCase(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

interface AttentionItem {
  key: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  detail: string;
  href: string;
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

  const firstName = session?.user?.name?.split(" ")[0] ?? null;
  const gov = data?.governance;
  const nistCoverage = gov?.frameworks.find((f) => f.id === "NIST-AI-RMF")?.coverage ?? null;
  const pending = loading && !data;
  // Time-of-day text is computed on the client only: the server renders in
  // UTC, which would greet users in other time zones wrongly (and mismatch).
  const [clock, setClock] = useState<{ today: string; greeting: string } | null>(null);
  useEffect(() => {
    setClock({
      today: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      greeting: greeting(),
    });
  }, []);

  // What needs a decision this week, derived from the snapshot.
  const attention = useMemo<AttentionItem[]>(() => {
    if (!gov) return [];
    const items: AttentionItem[] = [];
    if (gov.inventory.overdue > 0) {
      const first = gov.systems.find((s) => formatReview(s.nextReviewAt).overdue);
      items.push({
        key: "overdue",
        icon: CalendarClock,
        tone: "text-terminal-amber bg-terminal-amber/10",
        title: `${gov.inventory.overdue} review${gov.inventory.overdue === 1 ? "" : "s"} overdue`,
        detail: first ? `${first.name} is past its review date` : "Systems are past their review date",
        href: "/inventory",
      });
    }
    if (gov.inventory.high > 0) {
      items.push({
        key: "high",
        icon: ShieldAlert,
        tone: "text-terminal-red bg-terminal-red/10",
        title: `${gov.inventory.high} high-impact system${gov.inventory.high === 1 ? "" : "s"}`,
        detail: "Confirm controls and human oversight are in place",
        href: "/inventory",
      });
    }
    const weakest = [...gov.frameworks].sort((a, b) => a.coverage - b.coverage)[0];
    if (weakest && weakest.coverage < 50) {
      const meta = FRAMEWORK_META[weakest.id];
      items.push({
        key: "coverage",
        icon: ShieldCheck,
        tone: "text-terminal-cyan bg-terminal-cyan/10",
        title: `${meta?.short ?? weakest.name} at ${weakest.coverage}% coverage`,
        detail: "Map controls to close the biggest compliance gap",
        href: "/compliance",
      });
    }
    if (gov.inventory.total === 0) {
      items.push({
        key: "register",
        icon: Server,
        tone: "text-terminal-green bg-terminal-green/10",
        title: "Register your first AI system",
        detail: "Your inventory is the foundation of every control",
        href: "/inventory",
      });
    }
    if (!data?.occupationalRole) {
      items.push({
        key: "assessment",
        icon: ClipboardList,
        tone: "text-terminal-muted bg-terminal-gray",
        title: "Personalize your program",
        detail: "A 5-minute assessment tailors priorities to your role",
        href: "/assessment",
      });
    }
    return items.slice(0, 4);
  }, [gov, data?.occupationalRole]);

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

      {/* ── Greeting ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div className="min-w-0">
          <p className="min-h-5 text-sm text-terminal-muted">{clock?.today ?? " "}</p>
          <h1 className="mt-1 font-serif text-[34px] font-normal leading-tight tracking-tight text-terminal-text">
            {clock?.greeting ?? "Welcome back"}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-terminal-muted">
            Here&apos;s where your AI governance program stands this week.
          </p>
        </div>
        <Link href="/inventory" className="btn-secondary">
          <Plus className="h-4 w-4" /> New AI system
        </Link>
      </header>

      {/* ── Ask Govi ─────────────────────────────────────────────── */}
      <AskGovi />

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 text-sm text-terminal-red">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
          <button onClick={() => fetchDashboard()} className="text-xs underline">
            Retry
          </button>
        </div>
      )}

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          tone="green"
          label="AI systems"
          value={pending ? "—" : gov?.inventory.total ?? 0}
          delta={gov && gov.deltas.systems7d > 0 ? `+${gov.deltas.systems7d} this week` : undefined}
          trend={gov?.systemsTrend}
        />
        <KpiCard
          tone="red"
          label="High impact"
          value={pending ? "—" : gov?.inventory.high ?? 0}
          delta={gov && gov.deltas.high7d > 0 ? `+${gov.deltas.high7d} this week` : undefined}
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
                <span className="text-lg font-normal text-terminal-muted">%</span>
              </>
            )
          }
          barPercent={gov?.averageCoverage ?? 0}
        />
        <KpiCard
          tone="amber"
          label="Overdue reviews"
          value={pending ? "—" : gov?.inventory.overdue ?? 0}
          delta={gov && gov.inventory.overdue > 0 ? "Action needed" : undefined}
          trend={gov?.overdueTrend}
        />
      </div>

      {/* ── Attention · Compliance · Priorities ──────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Needs attention">
          {pending ? (
            <PanelSpinner />
          ) : attention.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-terminal-muted">
              <CheckCircle2 className="h-5 w-5 text-terminal-green" />
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="p-2">
              {attention.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.key}>
                    <Link
                      href={a.href}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-terminal-gray/70"
                    >
                      <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${a.tone}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-terminal-text">{a.title}</span>
                        <span className="block truncate text-xs text-terminal-muted">{a.detail}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 flex-none text-terminal-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Compliance posture" action={<PanelLink href="/compliance">Open</PanelLink>} padded>
          <div className="flex flex-col gap-5">
            {(gov?.frameworks ?? Object.keys(FRAMEWORK_META).map((id) => ({ id, name: id, coverage: 0 }))).map(
              (fw) => {
                const meta = FRAMEWORK_META[fw.id] ?? { short: fw.name, hint: "", bar: "bg-terminal-muted" };
                return (
                  <div key={fw.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-terminal-text">
                        {meta.short}
                        {meta.hint && (
                          <span className="ml-2 text-xs font-normal text-terminal-muted">{meta.hint}</span>
                        )}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-terminal-text">
                        {pending ? "—" : `${fw.coverage}%`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-terminal-gray">
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

        <div className="lg:col-span-2 xl:col-span-1">
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

      {/* ── Inventory ────────────────────────────────────────────── */}
      <Panel
        title="AI system inventory"
        action={<PanelLink href="/inventory">View all {gov?.inventory.total ?? 0}</PanelLink>}
      >
        {pending ? (
          <PanelSpinner />
        ) : !gov || gov.systems.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Server className="mx-auto mb-4 h-9 w-9 text-terminal-muted" />
            <p className="mb-1 font-medium text-terminal-text">No AI systems registered yet</p>
            <p className="mb-6 text-sm text-terminal-muted">
              Start your register by adding the AI tools and models your team uses.
            </p>
            <Link href="/inventory" className="btn-primary">
              <Plus className="h-4 w-4" /> Register your first system
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-terminal-border text-xs text-terminal-muted">
                  <th className="px-5 py-2.5 font-medium">System</th>
                  <th className="hidden px-5 py-2.5 font-medium md:table-cell">Vendor</th>
                  <th className="px-5 py-2.5 font-medium">Risk</th>
                  <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Lifecycle</th>
                  <th className="hidden px-5 py-2.5 font-medium lg:table-cell">Next review</th>
                </tr>
              </thead>
              <tbody>
                {gov.systems.map((s) => {
                  const review = formatReview(s.nextReviewAt);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-terminal-border/70 transition-colors last:border-b-0 hover:bg-terminal-gray/50"
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-terminal-text">{s.name}</div>
                        {s.model && <div className="text-xs text-terminal-muted">{s.model}</div>}
                      </td>
                      <td className="hidden px-5 py-3 text-terminal-muted md:table-cell">{s.vendor || "—"}</td>
                      <td className="px-5 py-3">
                        <RiskPill risk={s.riskCategory} />
                      </td>
                      <td className="hidden px-5 py-3 sm:table-cell">
                        <StagePill stage={s.lifecycleStage} />
                      </td>
                      <td
                        className={`hidden px-5 py-3 tabular-nums lg:table-cell ${
                          review.overdue ? "font-medium text-terminal-amber" : "text-terminal-muted"
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

      {/* ── Recent Govi chats + activity ─────────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Recent Govi chats"
          action={
            <button
              onClick={exportCsv}
              disabled={!data?.recentConversations.length}
              className="inline-flex items-center gap-1.5 text-sm text-terminal-muted transition-colors hover:text-terminal-text disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          }
        >
          {pending ? (
            <PanelSpinner />
          ) : data?.recentConversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <MessageSquare className="mx-auto mb-3 h-9 w-9 text-terminal-muted" />
              <p className="mb-4 text-sm text-terminal-muted">No chats yet. Ask Govi about your first use case.</p>
              <Link href="/govi" className="btn-primary">
                Start a chat <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="p-2">
              {data?.recentConversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/govi?c=${c.id}`}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-terminal-gray/70"
                  >
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-terminal-gray text-terminal-muted">
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-terminal-text">{c.title}</span>
                      <span className="block text-xs text-terminal-muted">
                        {c.messageCount} messages · {timeAgo(c.updatedAt)}
                      </span>
                    </span>
                    <SeverityPill level={c.riskLevel} />
                    <ArrowRight className="hidden h-4 w-4 flex-none text-terminal-muted opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Activity" action={<PanelLink href="/audit">Audit trail</PanelLink>}>
          <ActivityTimeline events={data?.recentEvents ?? []} pending={pending} />
        </Panel>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-terminal-muted">
          <span className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                data.systemStatus === "offline"
                  ? "bg-terminal-red"
                  : data.systemStatus === "degraded"
                  ? "bg-terminal-amber"
                  : "bg-terminal-green"
              }`}
              aria-hidden="true"
            />
            {data.systemStatus === "offline"
              ? "Systems offline"
              : data.systemStatus === "degraded"
              ? "Systems degraded"
              : "All systems operational"}
            <span aria-hidden="true">·</span> {sentenceCase(data.stats.plan.toLowerCase())} plan
          </span>
          {data.memberSince && (
            <span>
              Member since{" "}
              {new Date(data.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      )}
    </AppPage>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function PanelSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-terminal-muted" />
    </div>
  );
}

/**
 * Claude-home-style composer that hands off to Govi. It only pre-fills the
 * question on /govi (never auto-sends), so a reload can't resend it.
 */
function AskGovi() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (text: string) => {
    const query = text.trim();
    router.push(query ? `/govi?new=${Date.now()}&q=${encodeURIComponent(query)}` : `/govi?new=${Date.now()}`);
  };

  return (
    <section aria-label="Ask Govi">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="surface shadow-app flex items-center gap-3 rounded-2xl py-2 pl-3 pr-2 focus-within:border-terminal-text/35"
      >
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-terminal-green text-sm font-semibold text-[var(--color-bg-secondary)]">
          G
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask Govi about a use case, regulation, or control…"
          aria-label="Ask Govi"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] text-terminal-text outline-none placeholder:text-terminal-muted"
        />
        <button
          type="submit"
          aria-label="Continue in Govi"
          className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-terminal-green text-[var(--color-bg-secondary)] transition-colors hover:bg-terminal-green-dim"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {GOVI_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            className="rounded-full border border-terminal-border px-3 py-1 text-xs text-terminal-muted transition-colors hover:bg-terminal-dark hover:text-terminal-text"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}

const EVENT_ICON: Record<AuditEvent["tone"], { icon: LucideIcon; tone: string }> = {
  success: { icon: CheckCircle2, tone: "text-terminal-green" },
  warn: { icon: AlertTriangle, tone: "text-terminal-amber" },
  error: { icon: XCircle, tone: "text-terminal-red" },
  info: { icon: Activity, tone: "text-terminal-muted" },
};

/** Muse-style activity feed: events grouped by day, icon chip + title + time. */
function ActivityTimeline({ events, pending }: { events: AuditEvent[]; pending: boolean }) {
  if (pending) return <PanelSpinner />;
  if (events.length === 0) {
    return <p className="px-5 py-6 text-sm text-terminal-muted">No activity yet. Changes will appear here.</p>;
  }
  const groups: { label: string; items: AuditEvent[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return (
    <div className="max-h-[360px] overflow-y-auto px-5 py-4">
      {groups.map((g) => (
        <div key={g.label} className="mb-4 last:mb-0">
          <p className="mb-2 text-xs font-medium text-terminal-muted">{g.label}</p>
          <ul className="space-y-3">
            {g.items.map((e) => {
              const { icon: Icon, tone } = EVENT_ICON[e.tone];
              return (
                <li key={e.id} className="flex gap-3">
                  <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md bg-terminal-gray ${tone}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-terminal-text">{sentenceCase(e.event.replace(/_/g, " "))}</span>
                    <span className="block text-xs text-terminal-muted">
                      {e.category ? `${sentenceCase(e.category)} · ` : ""}
                      {formatClock(e.createdAt)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
