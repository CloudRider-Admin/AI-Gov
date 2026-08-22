"use client";

import Link from "next/link";
import {
  Server,
  ShieldCheck,
  ListChecks,
  FileText,
  Gauge,
  FileClock,
  FileBarChart,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/app";

// Role → prioritized surfaces (canonical tokens from occupationalRoles.ts).
const ROLE_MAP: Record<string, { label: string; keys: string[] }> = {
  security: { label: "Security / CISO", keys: ["inventory", "compliance", "tasks", "audit"] },
  "privacy-legal": { label: "Privacy / Legal", keys: ["compliance", "library", "inventory", "report"] },
  engineering: { label: "Engineering", keys: ["inventory", "tasks", "compliance", "library"] },
  executive: { label: "Executive", keys: ["maturity", "report", "inventory", "compliance"] },
  operations: { label: "Operations / Product", keys: ["tasks", "inventory", "assessment", "maturity"] },
  governance: { label: "Risk & Compliance", keys: ["maturity", "compliance", "audit", "report"] },
};

const DEFAULT = { label: "your role", keys: ["assessment", "inventory", "maturity", "compliance"] };

export interface PriorityStats {
  maturityScore: number | null;
  nistCoverage: number | null;
  auditEventsToday: number | null;
  inventoryTotal: number | null;
}

function maturityLevel(score: number): string {
  if (score >= 90) return "Level 5 · Optimized";
  if (score >= 75) return "Level 4 · Managed";
  if (score >= 50) return "Level 3 · Defined";
  if (score >= 25) return "Level 2 · Developing";
  return "Level 1 · Initial";
}

interface FeedItem {
  href: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  metric: string;
}

function buildItem(key: string, stats: PriorityStats): FeedItem | null {
  switch (key) {
    case "maturity":
      return {
        href: "/maturity",
        icon: Gauge,
        title: "Maturity",
        sub: stats.maturityScore != null ? maturityLevel(stats.maturityScore) : "Governance score",
        metric: stats.maturityScore != null ? `${stats.maturityScore}/100` : "→",
      };
    case "compliance":
      return {
        href: "/compliance",
        icon: ShieldCheck,
        title: "Compliance",
        sub: "NIST coverage",
        metric: stats.nistCoverage != null ? `${stats.nistCoverage}%` : "→",
      };
    case "audit":
      return {
        href: "/audit",
        icon: FileClock,
        title: "Audit trail",
        sub:
          stats.auditEventsToday != null
            ? `${stats.auditEventsToday} event${stats.auditEventsToday === 1 ? "" : "s"} today`
            : "Every change, logged",
        metric: "→",
      };
    case "report":
      return { href: "/report", icon: FileBarChart, title: "Board report", sub: "Ready to export", metric: "→" };
    case "inventory":
      return {
        href: "/inventory",
        icon: Server,
        title: "AI inventory",
        sub: "Systems registered",
        metric: stats.inventoryTotal != null ? String(stats.inventoryTotal) : "→",
      };
    case "tasks":
      return { href: "/tasks", icon: ListChecks, title: "Remediation", sub: "Open governance work", metric: "→" };
    case "library":
      return { href: "/library", icon: FileText, title: "Documents", sub: "Policies & evidence", metric: "→" };
    case "assessment":
      return { href: "/assessment", icon: ClipboardList, title: "Assessment", sub: "Personalize your program", metric: "→" };
    default:
      return null;
  }
}

/**
 * "Priorities · <role>" feed: the four surfaces this user's role cares about
 * most, each with a live metric where one exists.
 */
export function RolePriorities({ role, stats }: { role: string | null; stats: PriorityStats }) {
  const config = (role && ROLE_MAP[role]) || DEFAULT;
  const items = config.keys
    .map((k) => buildItem(k, stats))
    .filter((i): i is FeedItem => i !== null);

  return (
    <Panel
      title={`Priorities · ${config.label}`}
      action={
        !role && (
          <Link href="/assessment" className="text-terminal-green hover:underline">
            Personalize →
          </Link>
        )
      }
    >
      <div className="p-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-300 hover:bg-terminal-gray/30"
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-terminal-border bg-terminal-gray/30 text-terminal-muted">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-terminal-text">{item.title}</span>
                <span className="block truncate text-xs text-terminal-muted">{item.sub}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-terminal-muted">{item.metric}</span>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}
