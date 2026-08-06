"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  FlaskConical,
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
  Circle,
  ShieldOff,
} from "lucide-react";
import { GATE_SPECS, ENTITY_KIND_LABELS, type EntityKind } from "@/lib/gates/gateEnums";
import {
  APPROVAL_LABELS,
  APPROVAL_STYLES,
  GATE_STATUS_LABELS,
  GATE_STATUS_STYLES,
  RISK_STYLES,
  STAGE_LABELS,
} from "@/components/gates/gateStyles";
import type {
  ApprovalEligibilityView,
  EvaluationRunView,
  GateRecordView,
  GateSystemView,
  OpenTaskView,
} from "@/components/gates/types";
import { Gate2Panel } from "./Gate2Panel";
import { Gate3Panel } from "./Gate3Panel";

const GATE_ICONS = { 1: ClipboardList, 2: FlaskConical, 3: BadgeCheck } as const;

export function GateDetailClient({
  system: initialSystem,
  gates: initialGates,
  runs: initialRuns,
  approval: initialApproval,
  openTasks,
}: {
  system: GateSystemView;
  gates: GateRecordView[];
  runs: EvaluationRunView[];
  approval: ApprovalEligibilityView | null;
  openTasks: OpenTaskView[];
}) {
  const router = useRouter();
  const [system, setSystem] = useState(initialSystem);
  const [gates, setGates] = useState(initialGates);
  const [runs, setRuns] = useState(initialRuns);
  const [approval, setApproval] = useState(initialApproval);
  const [activeGate, setActiveGate] = useState<number>(() => {
    const firstOpen = initialGates.find((g) => g.status !== "passed" && g.status !== "waived");
    return firstOpen?.gate ?? 3;
  });

  /**
   * Any action that can move a gate re-reads the whole detail from the server
   * rather than patching local state — gate status is derived from several
   * sources and a hand-rolled optimistic update would drift.
   */
  const refresh = async () => {
    const res = await fetch(`/api/gates/${system.id}`);
    if (res.ok) {
      const data = await res.json();
      setGates(
        (data.gates ?? []).map((g: Record<string, unknown>) => ({
          gate: g.gate as number,
          status: g.status as string,
          summary: (g.summary as string) ?? null,
          blockers: (g.blockers as string[]) ?? [],
          decidedByName: (g.decidedByName as string) ?? null,
          decidedAt: g.decidedAt ? String(g.decidedAt) : null,
        })),
      );
      setApproval(data.approval ?? null);
    }
    router.refresh();
  };

  const gateFor = (gate: number) => gates.find((g) => g.gate === gate);

  return (
    <div className="section min-h-screen">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/gates"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-terminal-muted hover:text-terminal-text mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All gates
        </Link>

        {/* Header */}
        <header className="mb-8">
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 block">
            Governance / Gates / {ENTITY_KIND_LABELS[system.entityKind as EntityKind] ?? system.entityKind}
          </span>
          <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-3">
            {system.name}
          </h1>
          {system.purpose && (
            <p className="text-terminal-muted font-sans max-w-3xl mb-4">{system.purpose}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={RISK_STYLES[system.riskCategory] ?? RISK_STYLES.low}>
              {system.riskCategory} risk
            </Badge>
            <Badge className={APPROVAL_STYLES[system.approvalStatus ?? 'not-required']}>
              {APPROVAL_LABELS[system.approvalStatus ?? 'not-required']}
            </Badge>
            <span className="font-mono text-xs text-terminal-muted">
              {STAGE_LABELS[system.lifecycleStage] ?? system.lifecycleStage}
            </span>
            {system.businessOwner && (
              <span className="font-mono text-xs text-terminal-muted">
                Owner: {system.businessOwner}
              </span>
            )}
          </div>
        </header>

        {/* Gate rail */}
        <nav className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8" aria-label="Gates">
          {[1, 2, 3].map((gate) => {
            const record = gateFor(gate);
            const status = record?.status ?? "not-started";
            const Icon = GATE_ICONS[gate as 1 | 2 | 3];
            const isActive = activeGate === gate;

            return (
              <button
                key={gate}
                onClick={() => setActiveGate(gate)}
                aria-current={isActive ? "step" : undefined}
                className={`glass-card rounded-xl p-4 text-left transition-colors ${
                  isActive ? "border-terminal-green/50" : "hover:border-terminal-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-terminal-green shrink-0" />
                    <span className="font-mono text-xs text-terminal-muted uppercase tracking-wider">
                      Gate {gate}
                    </span>
                  </div>
                  <StatusIcon status={status} />
                </div>
                <div className="font-mono text-sm text-terminal-text mb-1.5">
                  {GATE_SPECS[gate as 1 | 2 | 3].name}
                </div>
                <Badge className={GATE_STATUS_STYLES[status] ?? GATE_STATUS_STYLES["not-started"]}>
                  {GATE_STATUS_LABELS[status] ?? status}
                </Badge>
              </button>
            );
          })}
        </nav>

        {/* Active gate panel */}
        {activeGate === 1 && <Gate1Panel system={system} record={gateFor(1)} />}
        {activeGate === 2 && (
          <Gate2Panel
            system={system}
            record={gateFor(2)}
            runs={runs}
            onRunsChange={setRuns}
            onGateChange={refresh}
          />
        )}
        {activeGate === 3 && (
          <Gate3Panel
            system={system}
            record={gateFor(3)}
            approval={approval}
            openTasks={openTasks}
            onDecision={(updated) => {
              setSystem((prev) => ({ ...prev, ...updated }));
              void refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Gate 1 ─────────────────────────────────────────────────────────────────

function Gate1Panel({ system, record }: { system: GateSystemView; record?: GateRecordView }) {
  const criteria = GATE_SPECS[1].exitCriteria;
  // Mirrors evaluateGate1's checks so the UI explains the same decision the
  // server made, rather than a second opinion about it.
  const met = [
    Boolean(system.purpose?.trim()) && Boolean(system.name?.trim()),
    Boolean(system.businessOwner?.trim()),
    Boolean(system.riskCategory),
    system.dataTypes.length > 0,
  ];

  return (
    <section className="glass-card rounded-xl p-6">
      <PanelHeader
        title={GATE_SPECS[1].name}
        purpose={GATE_SPECS[1].purpose}
        record={record}
      />

      <h3 className="font-mono text-xs uppercase tracking-wider text-terminal-muted mb-3">
        Exit criteria
      </h3>
      <ul className="space-y-2 mb-6">
        {criteria.map((criterion, i) => (
          <li key={criterion} className="flex items-start gap-2 text-sm">
            {met[i] ? (
              <CheckCircle2 className="w-4 h-4 text-terminal-green shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-terminal-muted shrink-0 mt-0.5" />
            )}
            <span className={met[i] ? "text-terminal-text" : "text-terminal-muted"}>{criterion}</span>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-terminal-border">
        <Detail label="Entity kind" value={ENTITY_KIND_LABELS[system.entityKind as EntityKind] ?? system.entityKind} />
        <Detail label="Business owner" value={system.businessOwner || "—"} />
        <Detail label="Vendor" value={system.vendor || "—"} />
        <Detail label="Data types" value={system.dataTypes.length > 0 ? system.dataTypes.join(", ") : "—"} />
      </dl>

      <div className="mt-6 pt-4 border-t border-terminal-border">
        <Link href="/inventory" className="btn-secondary text-sm py-2 inline-flex">
          Edit in the register
        </Link>
      </div>
    </section>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

export function PanelHeader({
  title,
  purpose,
  record,
}: {
  title: string;
  purpose: string;
  record?: GateRecordView;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-mono font-bold text-terminal-text mb-2">{title}</h2>
      <p className="text-terminal-muted text-sm mb-4">{purpose}</p>

      {record?.summary && (
        <p className="font-mono text-sm text-terminal-text border-l-2 border-terminal-green/40 pl-3 mb-3">
          {record.summary}
        </p>
      )}

      {record && record.blockers.length > 0 && (
        <div className="rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-terminal-amber" />
            <span className="font-mono text-xs uppercase tracking-wider text-terminal-amber">
              Blocking
            </span>
          </div>
          <ul className="space-y-1">
            {record.blockers.map((blocker) => (
              <li key={blocker} className="text-sm text-terminal-text">
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}

      {record?.status === "waived" && (
        <div className="flex items-start gap-2 rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/10 p-3 mt-3">
          <ShieldOff className="w-4 h-4 text-terminal-cyan shrink-0 mt-0.5" />
          <p className="text-sm text-terminal-text">
            This gate was waived
            {record.decidedByName ? ` by ${record.decidedByName}` : ""}
            {record.decidedAt ? ` on ${new Date(record.decidedAt).toLocaleDateString()}` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "passed") return <CheckCircle2 className="w-4 h-4 text-terminal-green" />;
  if (status === "failed") return <AlertTriangle className="w-4 h-4 text-terminal-red" />;
  if (status === "waived") return <ShieldOff className="w-4 h-4 text-terminal-cyan" />;
  if (status === "in-progress") return <Circle className="w-4 h-4 text-terminal-amber" />;
  return <Circle className="w-4 h-4 text-terminal-muted" />;
}

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase ${className}`}>
      {children}
    </span>
  );
}

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-terminal-muted mb-1">
        {label}
      </dt>
      <dd className="text-sm text-terminal-text break-words">{value}</dd>
    </div>
  );
}
