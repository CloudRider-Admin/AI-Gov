"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  FlaskConical,
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Server,
} from "lucide-react";
import { GATE_SPECS, ENTITY_KIND_LABELS, ENTITY_KINDS, type EntityKind } from "@/lib/gates/gateEnums";
import type { GateBoardEntry } from "@/lib/gates/gates";
import {
  APPROVAL_LABELS,
  APPROVAL_STYLES,
  GATE_STATUS_LABELS,
  GATE_STATUS_STYLES,
  RISK_STYLES,
} from "@/components/gates/gateStyles";

interface Summary {
  total: number;
  atGate1: number;
  atGate2: number;
  atGate3: number;
  cleared: number;
  blocked: number;
  awaitingApproval: number;
  byKind: Record<string, number>;
}

const COLUMNS = [
  { gate: 1, icon: ClipboardList },
  { gate: 2, icon: FlaskConical },
  { gate: 3, icon: BadgeCheck },
  { gate: 4, icon: CheckCircle2 },
] as const;

const COLUMN_TITLES: Record<number, string> = {
  1: GATE_SPECS[1].name,
  2: GATE_SPECS[2].name,
  3: GATE_SPECS[3].name,
  4: "Cleared",
};

const COLUMN_BLURBS: Record<number, string> = {
  1: GATE_SPECS[1].purpose,
  2: GATE_SPECS[2].purpose,
  3: GATE_SPECS[3].purpose,
  4: "All three gates passed. Registered and in service.",
};

type KindFilter = "all" | EntityKind;

export function GatesBoardClient({ board, summary }: { board: GateBoardEntry[]; summary: Summary }) {
  const [kind, setKind] = useState<KindFilter>("all");

  const filtered = useMemo(
    () => (kind === "all" ? board : board.filter((e) => e.entityKind === kind)),
    [board, kind],
  );

  const columns = useMemo(() => {
    const grouped: Record<number, GateBoardEntry[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const entry of filtered) grouped[entry.currentGate]?.push(entry);
    return grouped;
  }, [filtered]);

  return (
    <div className="section min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 block">
            Governance / Gates
          </span>
          <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-3">
            Governance Gates
          </h1>
          <p className="text-terminal-muted font-sans max-w-3xl">
            Every use case, agent, and model passes the same three gates before it reaches
            production: intake and risk tiering, evaluation and review against the core evaluation
            parameters, then a named approval decision.
          </p>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <SummaryCard icon={<Server className="w-4 h-4" />} label="In pipeline" value={summary.total} />
          <SummaryCard
            icon={<CheckCircle2 className="w-4 h-4 text-terminal-green" />}
            label="Cleared all gates"
            value={summary.cleared}
          />
          <SummaryCard
            icon={<BadgeCheck className="w-4 h-4 text-terminal-amber" />}
            label="Awaiting approval"
            value={summary.awaitingApproval}
          />
          <SummaryCard
            icon={<AlertTriangle className="w-4 h-4 text-terminal-red" />}
            label="Blocked"
            value={summary.blocked}
          />
        </div>

        {/* Entity kind filter */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
            All ({board.length})
          </FilterChip>
          {ENTITY_KINDS.map((k) => (
            <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
              {ENTITY_KIND_LABELS[k]}s ({summary.byKind[k] ?? 0})
            </FilterChip>
          ))}
        </div>

        {board.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <ClipboardList className="w-10 h-10 text-terminal-muted mx-auto mb-4" />
            <p className="font-mono text-terminal-text mb-2">Nothing in the pipeline yet</p>
            <p className="text-terminal-muted text-sm mb-6">
              Register a use case, agent, or model to start it through Gate 1.
            </p>
            <Link href="/inventory" className="btn-primary text-sm py-2 inline-flex">
              Go to the register <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {COLUMNS.map(({ gate, icon: Icon }) => (
              <section key={gate} className="flex flex-col">
                <div className="flex items-start gap-2 mb-3 px-1">
                  <Icon className="w-4 h-4 text-terminal-green mt-0.5 shrink-0" />
                  <div>
                    <h2 className="font-mono text-sm text-terminal-text">
                      {gate < 4 ? `Gate ${gate} — ` : ""}
                      {COLUMN_TITLES[gate]}
                    </h2>
                    <p className="text-[11px] text-terminal-muted mt-0.5 leading-snug">
                      {COLUMN_BLURBS[gate]}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {columns[gate].length === 0 ? (
                    <div className="rounded-lg border border-dashed border-terminal-border px-4 py-6 text-center">
                      <span className="font-mono text-[11px] text-terminal-muted">Empty</span>
                    </div>
                  ) : (
                    columns[gate].map((entry) => <BoardCard key={entry.id} entry={entry} />)
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BoardCard({ entry }: { entry: GateBoardEntry }) {
  const current = entry.gates.find((g) => g.gate === entry.currentGate);
  const blockers = current?.blockers ?? [];

  return (
    <Link
      href={`/gates/${entry.id}`}
      className="block glass-card rounded-lg p-3 hover:border-terminal-green/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-sm text-terminal-text leading-tight">{entry.name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-terminal-muted shrink-0 mt-0.5">
          {ENTITY_KIND_LABELS[entry.entityKind as EntityKind] ?? entry.entityKind}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Badge className={RISK_STYLES[entry.riskCategory] ?? RISK_STYLES.minimal}>
          {entry.riskCategory}
        </Badge>
        {entry.approvalStatus != null && (
          <Badge className={APPROVAL_STYLES[entry.approvalStatus]}>
            {APPROVAL_LABELS[entry.approvalStatus]}
          </Badge>
        )}
      </div>

      {/* Gate progress */}
      <div className="flex items-center gap-1 mb-2" aria-label="Gate progress">
        {[1, 2, 3].map((g) => {
          const record = entry.gates.find((x) => x.gate === g);
          const status = record?.status ?? "not-started";
          return (
            <span
              key={g}
              title={`Gate ${g}: ${GATE_STATUS_LABELS[status] ?? status}`}
              className={`h-1.5 flex-1 rounded-full border ${
                GATE_STATUS_STYLES[status] ?? GATE_STATUS_STYLES["not-started"]
              }`}
            />
          );
        })}
      </div>

      {blockers.length > 0 && (
        <p className="text-[11px] text-terminal-amber leading-snug line-clamp-2">{blockers[0]}</p>
      )}
      {entry.openRemediation > 0 && (
        <p className="text-[11px] text-terminal-muted mt-1">
          {entry.openRemediation} open remediation task{entry.openRemediation === 1 ? "" : "s"}
        </p>
      )}
    </Link>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase ${className}`}>
      {children}
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full border font-mono text-xs transition-colors ${
        active
          ? "border-terminal-green text-terminal-green bg-terminal-green/10"
          : "border-terminal-border text-terminal-muted hover:text-terminal-text"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass-card rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-terminal-muted mb-1">
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-terminal-text">{value}</div>
    </div>
  );
}
