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
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

interface PriorityLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

const LINKS: Record<string, PriorityLink> = {
  inventory: { label: "AI inventory", href: "/inventory", icon: Server },
  compliance: { label: "Compliance", href: "/compliance", icon: ShieldCheck },
  tasks: { label: "Remediation", href: "/tasks", icon: ListChecks },
  library: { label: "Documents", href: "/library", icon: FileText },
  maturity: { label: "Maturity", href: "/maturity", icon: Gauge },
  audit: { label: "Audit trail", href: "/audit", icon: FileClock },
  report: { label: "Board report", href: "/report", icon: FileBarChart },
  assessment: { label: "Assessment", href: "/assessment", icon: ClipboardList },
};

// Role → prioritized surfaces (canonical tokens from occupationalRoles.ts).
const ROLE_MAP: Record<string, { label: string; keys: string[] }> = {
  security: { label: "Security / CISO", keys: ["inventory", "compliance", "tasks", "audit"] },
  "privacy-legal": { label: "Privacy / Legal", keys: ["compliance", "library", "inventory", "report"] },
  engineering: { label: "Engineering", keys: ["inventory", "tasks", "compliance", "library"] },
  executive: { label: "Executive", keys: ["maturity", "report", "inventory", "compliance"] },
  operations: { label: "Operations / Product", keys: ["tasks", "inventory", "assessment", "maturity"] },
  governance: { label: "Risk / Compliance", keys: ["compliance", "audit", "maturity", "report"] },
};

const DEFAULT = { label: "your role", keys: ["assessment", "inventory", "maturity", "compliance"] };

export function RolePriorities({ role }: { role: string | null }) {
  const config = (role && ROLE_MAP[role]) || DEFAULT;
  const links = config.keys.map((k) => LINKS[k]).filter(Boolean);

  return (
    <div className="rounded-2xl border border-terminal-border bg-terminal-dark/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-terminal-muted">
          Priorities for {config.label}
        </h2>
        {!role && (
          <Link href="/assessment" className="text-[11px] text-terminal-green hover:underline flex items-center gap-1">
            Personalize <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-center gap-2.5 rounded-xl border border-terminal-border px-3 py-3 hover:border-terminal-green/40 hover:bg-terminal-green/5 transition-colors"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-terminal-green/10 text-terminal-green">
                <Icon className="w-4 h-4" />
              </span>
              <span className="text-sm text-terminal-text group-hover:text-terminal-green transition-colors">
                {l.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
