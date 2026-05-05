"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  MessageSquare,
  BarChart3,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Loader2,
  Globe,
  Download,
  Layers,
} from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";

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

interface FrameworkUsage {
  name: string;
  percent: number;
  count: number;
  tone: "green" | "amber" | "cyan";
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
  recentConversations: RecentConversation[];
  systemStatus: "nominal" | "degraded" | "offline";
  sessionsLast7Days: number[];
  messagesLast7Days: number[];
  deltas: { sessionsPct: number; messagesPct: number };
  riskBreakdown: { high: number; medium: number; low: number };
  recentEvents: AuditEvent[];
  frameworkStatus: FrameworkUsage[];
}

const POLL_MS = 30_000;

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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatDelta(n: number): string {
  if (n === 0) return "Stable —";
  return `${n > 0 ? "+" : ""}${n.toFixed(0)}% ${n > 0 ? "↑" : "↓"}`;
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
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      if (!r.ok) throw new Error(`Failed to load dashboard (${r.status})`);
      const d: DashboardData = await r.json();
      setData(d);
      if (d.onboardingCompleted === false) setShowWizard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const riskTotal =
    (data?.riskBreakdown.high ?? 0) +
    (data?.riskBreakdown.medium ?? 0) +
    (data?.riskBreakdown.low ?? 0);

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
    <div className="min-h-screen px-4 py-20 font-mono">
      {showWizard && <OnboardingWizard onComplete={() => setShowWizard(false)} />}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={`text-[11px] uppercase tracking-[0.22em] ${statusCopy.tone} mb-3`}>
              System Status: {statusCopy.label}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-terminal-text tracking-tight mb-2">
              Welcome back, <span className="text-terminal-green">{firstName}</span>
            </h1>
            <p className="text-sm text-terminal-muted max-w-2xl leading-relaxed">
              Real-time governance oversight for enterprise AI deployment and legislative
              compliance auditing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TeamAvatars name={firstName} />
            <button
              onClick={() => fetchDashboard()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs border border-terminal-border rounded-xl text-terminal-text hover:border-terminal-green/40 transition-colors disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              Manage Teams
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 text-sm text-terminal-red">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
            <button
              onClick={() => fetchDashboard()}
              className="text-xs underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Top stat cards ─────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-4">
          <SparkStatCard
            icon={<MessageSquare className="w-5 h-5 text-terminal-green" />}
            tint="green"
            label="AI Sessions Active"
            value={loading && !data ? "—" : formatNumber(data?.stats.conversations ?? 0)}
            delta={formatDelta(data?.deltas.sessionsPct ?? 0)}
            deltaTone={
              !data
                ? "text-terminal-muted"
                : (data?.deltas.sessionsPct ?? 0) > 0
                ? "text-terminal-green"
                : (data?.deltas.sessionsPct ?? 0) < 0
                ? "text-terminal-amber"
                : "text-terminal-muted"
            }
            sparkline={data?.sessionsLast7Days ?? []}
            sparkTone="green"
          />

          <SparkStatCard
            icon={<BarChart3 className="w-5 h-5 text-terminal-amber" />}
            tint="amber"
            label="Messages Analyzed"
            value={loading && !data ? "—" : formatNumber(data?.stats.messagesAnalyzed ?? 0)}
            delta={formatDelta(data?.deltas.messagesPct ?? 0)}
            deltaTone={
              !data
                ? "text-terminal-muted"
                : (data?.deltas.messagesPct ?? 0) > 0
                ? "text-terminal-green"
                : (data?.deltas.messagesPct ?? 0) < 0
                ? "text-terminal-amber"
                : "text-terminal-muted"
            }
            sparkline={data?.messagesLast7Days ?? []}
            sparkTone="amber"
          />

          {/* Risk flags dark card */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "#0f1012" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="w-10 h-10 rounded-xl bg-terminal-red/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-terminal-red" />
              </div>
              {riskTotal > 0 && (
                <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-md bg-terminal-red/20 text-terminal-red font-semibold">
                  Action Required
                </span>
              )}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-1">
              Risk Flags Detected
            </div>
            <div className="text-3xl font-bold text-white mb-3">
              {loading && !data ? "—" : riskTotal.toLocaleString()}
            </div>
            <div className="flex flex-wrap gap-2">
              {(data?.riskBreakdown.high ?? 0) > 0 && (
                <RiskChip label="HALLUCINATION" value={data!.riskBreakdown.high} />
              )}
              {(data?.riskBreakdown.medium ?? 0) > 0 && (
                <RiskChip label="LEAKAGE" value={data!.riskBreakdown.medium} />
              )}
              {(data?.riskBreakdown.low ?? 0) > 0 && (
                <RiskChip label="ANOMALY" value={data!.riskBreakdown.low} />
              )}
              {riskTotal === 0 && (
                <span className="text-xs text-white/60">No risk events detected.</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Recent sessions + sidebar ──────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Recent AI Sessions */}
          <div className="lg:col-span-2 rounded-xl border border-terminal-border bg-terminal-black p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-terminal-text">Recent AI Sessions</h2>
              <button
                onClick={exportCsv}
                disabled={!data?.recentConversations.length}
                className="inline-flex items-center gap-1 text-xs text-terminal-green hover:underline disabled:opacity-50"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </div>

            {loading && !data ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-terminal-muted" />
              </div>
            ) : data?.recentConversations.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="w-10 h-10 text-terminal-muted mx-auto mb-3" />
                <p className="text-sm text-terminal-muted mb-4">
                  No sessions yet. Start a conversation with the AI Advisor.
                </p>
                <Link
                  href="/govi"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-terminal-green text-terminal-black text-sm rounded-xl"
                >
                  Start your first session <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted border-b border-terminal-border">
                      <th className="text-left font-normal py-3 pr-4">Session ID</th>
                      <th className="text-left font-normal py-3 pr-4">Entity</th>
                      <th className="text-left font-normal py-3 pr-4">Risk Rating</th>
                      <th className="text-left font-normal py-3 pr-4">Timestamp</th>
                      <th className="text-right font-normal py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border">
                    {data?.recentConversations.map((c) => {
                      const risk = riskRating(c.riskLevel);
                      const initials = c.title
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase() ?? "")
                        .join("");
                      return (
                        <tr key={c.id} className="hover:bg-terminal-gray/30 transition-colors">
                          <td className="py-4 pr-4 text-terminal-muted text-xs">
                            #S-{c.id.slice(0, 4).toUpperCase()}-
                            {c.id.slice(4, 5).toUpperCase()}
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-terminal-gray text-terminal-text flex items-center justify-center text-[10px] font-bold">
                                {initials || "AI"}
                              </span>
                              <span className="text-terminal-text truncate max-w-[180px]">
                                {c.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <span
                              className={`inline-block text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-md font-semibold ${risk.tone}`}
                            >
                              {risk.label}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-terminal-muted text-xs">
                            {timeAgo(c.updatedAt)}
                          </td>
                          <td className="py-4 text-right">
                            <Link
                              href={`/govi?c=${c.id}`}
                              className="text-terminal-muted hover:text-terminal-green"
                              aria-label="Open session"
                            >
                              <ArrowRight className="w-4 h-4 inline" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar: Quick Actions + Framework Status + Live Stream */}
          <div className="space-y-4">
            <div className="rounded-xl border border-terminal-border bg-terminal-black p-5">
              <h3 className="text-sm font-bold text-terminal-text mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <QuickActionLink
                  href="/govi"
                  icon={<MessageSquare className="w-4 h-4 text-terminal-green" />}
                  title="Ask AI Advisor"
                  sub="Policy clarification & reasoning"
                />
                <QuickActionLink
                  href="/playbooks"
                  icon={<BookOpen className="w-4 h-4 text-terminal-green" />}
                  title="Browse Playbooks"
                  sub="Response protocols & mitigation"
                />
              </div>
            </div>

            <div className="rounded-xl border border-terminal-border bg-terminal-black p-5">
              <h3 className="text-sm font-bold text-terminal-text mb-4">Framework Status</h3>
              <div className="space-y-3">
                {(data?.frameworkStatus ?? []).map((fw) => (
                  <FrameworkRow key={fw.name} usage={fw} />
                ))}
                {!data?.frameworkStatus.length && (
                  <p className="text-xs text-terminal-muted">No framework activity yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Global data flow + live audit ──────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-terminal-border bg-terminal-black p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-terminal-text mb-2">Global Data Flow</h3>
              <p className="text-xs text-terminal-muted mb-5 leading-relaxed">
                Visualizing cross-border compliance and server residency monitoring.
              </p>
              <FlowRow
                dotColor="bg-terminal-green"
                title="US-East Resilience"
                detail="All nodes reported nominal latency."
              />
              <FlowRow
                dotColor="bg-terminal-amber"
                title="EU-Central Policy Sync"
                detail="Syncing GDPR local overrides (82%)."
              />
            </div>
            <div className="relative md:w-64 aspect-square md:aspect-auto rounded-xl bg-terminal-gray flex items-center justify-center overflow-hidden">
              <div className="absolute inset-6 bg-dot-pattern bg-dots opacity-40" />
              <Globe className="w-20 h-20 text-terminal-muted/40" />
              <span className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-md bg-terminal-black/60 text-terminal-text">
                Live Monitor
              </span>
            </div>
          </div>

          {/* LIVE AUDIT STREAM */}
          <div className="rounded-xl p-5 font-mono" style={{ backgroundColor: "#0f1012" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-terminal-green">
                Live Audit Stream
              </span>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {data?.recentEvents.length ? (
                data.recentEvents.map((e) => (
                  <AuditLine key={e.id} event={e} />
                ))
              ) : (
                <p className="text-xs text-white/60">No audit events yet. Activity will appear here.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer: plan + member since ──────────────────────── */}
        {data && (
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-terminal-muted pt-2">
            <span>Welcome back, {firstName} · Plan {data.stats.plan}</span>
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
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function TeamAvatars({ name }: { name: string }) {
  const initial = name[0]?.toUpperCase() ?? "A";
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        <span className="w-7 h-7 rounded-full bg-terminal-green text-terminal-black flex items-center justify-center text-[11px] font-bold border-2 border-terminal-black">
          {initial}
        </span>
        <span className="w-7 h-7 rounded-full bg-terminal-amber text-terminal-black flex items-center justify-center text-[11px] font-bold border-2 border-terminal-black">
          A
        </span>
      </div>
      <span className="text-[11px] text-terminal-muted">+4</span>
    </div>
  );
}

function SparkStatCard({
  icon,
  tint,
  label,
  value,
  delta,
  deltaTone,
  sparkline,
  sparkTone,
}: {
  icon: React.ReactNode;
  tint: "green" | "amber";
  label: string;
  value: string;
  delta: string;
  deltaTone: string;
  sparkline: number[];
  sparkTone: "green" | "amber";
}) {
  const tintBg = tint === "green" ? "bg-terminal-green/15" : "bg-terminal-amber/15";
  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-black p-5">
      <div className="flex items-center justify-between mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tintBg}`}>{icon}</div>
        <span className={`text-[10px] uppercase tracking-[0.18em] ${deltaTone}`}>{delta}</span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted mb-1">{label}</div>
      <div className="text-3xl font-bold text-terminal-text mb-4">{value}</div>
      <Sparkline data={sparkline} tone={sparkTone} />
    </div>
  );
}

function Sparkline({ data, tone }: { data: number[]; tone: "green" | "amber" }) {
  if (!data.length) {
    return <div className="h-10 rounded-md bg-terminal-gray/50" />;
  }
  const max = Math.max(1, ...data);
  const fill = tone === "green" ? "rgba(0, 204, 102, 0.2)" : "rgba(245, 158, 11, 0.2)";
  const stroke = tone === "green" ? "#00cc66" : "#f59e0b";
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`)
    .join(" ");
  return (
    <div className="h-10">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <polygon points={`0,100 ${pts} 100,100`} fill={fill} />
      </svg>
    </div>
  );
}

function RiskChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-terminal-green/15 text-terminal-green text-[10px] uppercase tracking-[0.18em] font-semibold">
      {label} ({value})
    </span>
  );
}

function QuickActionLink({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl border border-terminal-border hover:border-terminal-green/40 transition-colors group"
    >
      <div className="w-9 h-9 rounded-xl bg-terminal-green/10 flex items-center justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-terminal-text">{title}</div>
        <div className="text-[11px] text-terminal-muted truncate">{sub}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-terminal-muted group-hover:text-terminal-green" />
    </Link>
  );
}

function FrameworkRow({ usage }: { usage: FrameworkUsage }) {
  const barColor =
    usage.tone === "green"
      ? "bg-terminal-green"
      : usage.tone === "amber"
      ? "bg-terminal-amber"
      : "bg-terminal-cyan";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-terminal-text">{usage.name}</span>
        <span className="text-xs text-terminal-muted">{usage.percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-terminal-gray overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.max(2, usage.percent)}%` }} />
      </div>
    </div>
  );
}

function FlowRow({ dotColor, title, detail }: { dotColor: string; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 mb-4">
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <div>
        <div className="text-sm text-terminal-text">{title}</div>
        <div className="text-[11px] text-terminal-muted mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function AuditLine({ event }: { event: AuditEvent }) {
  const tone =
    event.tone === "error"
      ? "text-terminal-red"
      : event.tone === "warn"
      ? "text-terminal-amber"
      : event.tone === "success"
      ? "text-terminal-green"
      : "text-white/80";
  return (
    <div className="text-[11px] leading-relaxed flex gap-2">
      <span className="text-white/40 shrink-0">[{formatClock(event.createdAt)}]</span>
      <span className={tone}>
        <span className="text-white/80">{event.category}</span>: {event.summary}
      </span>
    </div>
  );
}
