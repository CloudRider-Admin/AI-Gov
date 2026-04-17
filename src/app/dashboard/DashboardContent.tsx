"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  MessageSquare,
  BarChart3,
  AlertTriangle,
  CreditCard,
  BookOpen,
  Shield,
  TrendingUp,
  ArrowRight,
  Clock,
  Loader2,
} from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";

interface DashboardData {
  stats: {
    conversations: number;
    messagesAnalyzed: number;
    riskFlags: number;
    plan: string;
  };
  memberSince: string | null;
  onboardingCompleted: boolean;
  recentConversations: {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
  }[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function DashboardContent() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const fetchDashboard = () => {
    setLoading(true);
    setError(null);
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load dashboard (${r.status})`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (d.onboardingCompleted === false) setShowWizard(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const stats = data
    ? [
        {
          label: "AI Sessions",
          value: String(data.stats.conversations),
          icon: MessageSquare,
          sub: "total conversations",
          highlight: false,
        },
        {
          label: "Messages Analyzed",
          value: String(data.stats.messagesAnalyzed),
          icon: BarChart3,
          sub: "across all sessions",
          highlight: false,
        },
        {
          label: "Risk Flags",
          value: String(data.stats.riskFlags),
          icon: AlertTriangle,
          sub: "messages with risk levels",
          highlight: data.stats.riskFlags > 0,
        },
        {
          label: "Plan",
          value: data.stats.plan,
          icon: CreditCard,
          sub:
            data.memberSince
              ? `member since ${new Date(data.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
              : "current tier",
          highlight: false,
        },
      ]
    : [];

  const quickActions = [
    { label: "Ask AI Advisor", href: "/govi", icon: MessageSquare },
    { label: "Browse Playbooks", href: "/playbooks", icon: BookOpen },
    { label: "Explore Topics", href: "/topics", icon: Shield },
    { label: "Learning Center", href: "/learn", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen px-4 py-20">
      {showWizard && (
        <OnboardingWizard onComplete={() => setShowWizard(false)} />
      )}
      <div className="max-w-7xl mx-auto">
        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 border border-red-500/40 bg-red-500/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm font-mono text-red-400">{error}</p>
            </div>
            <button
              onClick={fetchDashboard}
              className="text-xs font-mono text-terminal-muted hover:text-terminal-green transition-colors px-3 py-1 border border-terminal-border rounded"
            >
              Retry
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-mono font-bold text-terminal-green mb-2">
            Welcome back, {firstName}
          </h1>
          <p className="text-terminal-muted text-sm font-mono">
            Here&apos;s your AI governance activity at a glance.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="terminal-window glow-green">
                  <div className="terminal-header">
                    <div className="terminal-dot bg-red-500" />
                    <div className="terminal-dot bg-yellow-500" />
                    <div className="terminal-dot bg-green-500" />
                  </div>
                  <div className="p-6 flex items-center justify-center h-24">
                    <Loader2 className="w-5 h-5 text-terminal-muted animate-spin" />
                  </div>
                </div>
              ))
            : stats.map((stat, index) => (
                <div key={index} className="terminal-window glow-green">
                  <div className="terminal-header">
                    <div className="terminal-dot bg-red-500" />
                    <div className="terminal-dot bg-yellow-500" />
                    <div className="terminal-dot bg-green-500" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <stat.icon
                        className={`w-8 h-8 ${stat.highlight ? "text-yellow-400" : "text-terminal-green"}`}
                      />
                    </div>
                    <div
                      className={`text-3xl font-mono font-bold mb-1 ${stat.highlight ? "text-yellow-400" : "text-terminal-text"}`}
                    >
                      {stat.value}
                    </div>
                    <div className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">
                      {stat.label}
                    </div>
                    <div className="text-xs font-mono text-terminal-muted/60">
                      {stat.sub}
                    </div>
                  </div>
                </div>
              ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Conversations */}
          <div className="lg:col-span-2">
            <div className="terminal-window glow-green">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-xs text-terminal-muted font-mono">
                  recent_sessions.log
                </span>
              </div>
              <div className="p-6">
                <h2 className="text-xl font-mono font-bold text-terminal-green mb-4">
                  Recent AI Sessions
                </h2>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-terminal-muted animate-spin" />
                  </div>
                ) : data?.recentConversations.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-10 h-10 text-terminal-muted mx-auto mb-3" />
                    <p className="text-terminal-muted font-mono text-sm mb-4">
                      No sessions yet. Start a conversation with the AI Advisor.
                    </p>
                    <Link
                      href="/govi"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-terminal-green/10 border border-terminal-green text-terminal-green font-mono text-sm rounded hover:bg-terminal-green/20 transition-colors"
                    >
                      Start your first session
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.recentConversations.map((conv) => (
                      <Link
                        key={conv.id}
                        href={`/govi?c=${conv.id}`}
                        className="flex items-start gap-4 p-4 bg-terminal-black border border-terminal-border rounded hover:border-terminal-green transition-colors group"
                      >
                        <div className="p-2 rounded bg-terminal-green/10 text-terminal-green mt-0.5">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-mono text-sm text-terminal-text truncate group-hover:text-terminal-green transition-colors">
                            {conv.title}
                          </h3>
                          <p className="text-xs text-terminal-muted font-mono mt-0.5">
                            {conv.messageCount} message{conv.messageCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-terminal-muted/60 shrink-0">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs font-mono">{timeAgo(conv.updatedAt)}</span>
                        </div>
                      </Link>
                    ))}
                    <Link
                      href="/govi"
                      className="flex items-center justify-center gap-2 p-3 border border-dashed border-terminal-border rounded text-terminal-muted hover:border-terminal-green hover:text-terminal-green transition-colors font-mono text-xs"
                    >
                      New session <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions + Compliance */}
          <div className="space-y-6">
            <div className="terminal-window glow-green">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-xs text-terminal-muted font-mono">
                  quick_actions.sh
                </span>
              </div>
              <div className="p-6">
                <h2 className="text-xl font-mono font-bold text-terminal-green mb-4">
                  Quick Actions
                </h2>
                <div className="space-y-3">
                  {quickActions.map((action, index) => (
                    <Link
                      key={index}
                      href={action.href}
                      className="flex items-center justify-between p-4 bg-terminal-black border border-terminal-border rounded hover:border-terminal-green transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <action.icon className="w-5 h-5 text-terminal-green" />
                        <span className="font-mono text-sm text-terminal-text">
                          {action.label}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-terminal-muted group-hover:text-terminal-green transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="terminal-window glow-green">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-xs text-terminal-muted font-mono">
                  compliance.ref
                </span>
              </div>
              <div className="p-6">
                <h2 className="text-xl font-mono font-bold text-terminal-green mb-4">
                  Key Frameworks
                </h2>
                <div className="space-y-3">
                  {[
                    { name: "NIST AI RMF", href: "/playbooks" },
                    { name: "EU AI Act", href: "/topics" },
                    { name: "ISO/IEC 42001", href: "/topics" },
                    { name: "GDPR (AI scope)", href: "/topics" },
                  ].map((fw) => (
                    <Link
                      key={fw.name}
                      href={fw.href}
                      className="flex items-center justify-between group"
                    >
                      <span className="text-xs font-mono text-terminal-muted group-hover:text-terminal-text transition-colors">
                        {fw.name}
                      </span>
                      <span className="text-xs font-mono text-terminal-green/60 group-hover:text-terminal-green transition-colors">
                        explore →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
