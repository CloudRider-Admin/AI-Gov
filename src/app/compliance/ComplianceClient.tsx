"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import type { FrameworkPosture, ControlWithStatus } from "@/lib/compliance";
import { ASSESSMENT_STATUSES, type AssessmentStatus } from "@/lib/governanceEnums";
import { AppPage, PageHeader, Panel } from "@/components/app";

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  implemented: "Implemented",
  "not-applicable": "N/A",
};

const STATUS_STYLES: Record<AssessmentStatus, string> = {
  "not-started": "bg-terminal-muted/15 text-terminal-muted border-terminal-border",
  "in-progress": "bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40",
  implemented: "bg-terminal-green/15 text-terminal-green border-terminal-green/40",
  "not-applicable": "bg-terminal-muted/10 text-terminal-muted border-terminal-border",
};

function coverageColor(pct: number) {
  if (pct >= 75) return "text-terminal-green";
  if (pct >= 40) return "text-terminal-amber";
  return "text-terminal-red";
}

export function ComplianceClient({ initialFrameworks }: { initialFrameworks: FrameworkPosture[] }) {
  const [frameworks, setFrameworks] = useState(initialFrameworks);
  const [activeId, setActiveId] = useState(initialFrameworks[0]?.id ?? "");

  const active = frameworks.find((f) => f.id === activeId);

  const setStatus = async (control: ControlWithStatus, status: AssessmentStatus) => {
    if (!active) return;
    // Optimistic update + coverage recompute.
    setFrameworks((prev) =>
      prev.map((fw) => {
        if (fw.id !== active.id) return fw;
        const controls = fw.controls.map((c) => (c.id === control.id ? { ...c, status } : c));
        const counts: Record<AssessmentStatus, number> = {
          "not-started": 0,
          "in-progress": 0,
          implemented: 0,
          "not-applicable": 0,
        };
        controls.forEach((c) => (counts[c.status] += 1));
        const applicable = controls.length - counts["not-applicable"];
        const coverage = applicable > 0 ? Math.round((counts.implemented / applicable) * 100) : 100;
        return { ...fw, controls, counts, coverage };
      }),
    );

    await fetch("/api/compliance/assessments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ framework: active.id, controlId: control.id, status }),
    });
  };

  return (
    <AppPage>
      <PageHeader
        eyebrow="Governance / Compliance"
        title="Compliance Posture"
        description={
          <>
            How your AI governance measures up against the control frameworks that matter for U.S.
            organizations — the <strong className="text-terminal-text">NIST AI RMF</strong> and{" "}
            <strong className="text-terminal-text">ISO/IEC 42001</strong> first, with the EU AI Act
            available when you operate in the EU. Set each control&apos;s status to build an
            audit-ready record of where you stand and what to fix next.
          </>
        }
      />

      {/* Framework coverage cards / tabs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {frameworks.map((fw) => (
          <button
            key={fw.id}
            onClick={() => setActiveId(fw.id)}
            aria-pressed={fw.id === activeId}
            className={`glass rounded-xl p-4 text-left transition-all duration-300 hover:-translate-y-px ${
              fw.id === activeId ? "border-terminal-green/50" : "hover:border-terminal-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <ShieldCheck className="w-4 h-4 text-terminal-green" />
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${coverageColor(fw.coverage)}`}
              >
                {fw.coverage}%
              </span>
            </div>
            <div className="font-mono text-sm text-terminal-text">{fw.name}</div>
            <div className="text-xs text-terminal-muted mt-0.5">{fw.authority}</div>
            <div className="mt-4 h-1.5 rounded-full bg-terminal-gray/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-terminal-green transition-all"
                style={{ width: `${fw.coverage}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Control list for the active framework */}
      {active && (
        <Panel
          title={`${active.name} — controls`}
          action={
            <span className="font-normal text-terminal-muted">
              {active.counts.implemented} implemented · {active.counts["in-progress"]} in progress ·{" "}
              {active.counts["not-started"]} not started
            </span>
          }
        >
          <ul className="divide-y divide-terminal-border/50">
            {active.controls.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-terminal-green">{c.id}</span>
                    <span className="text-sm font-medium text-terminal-text">{c.title}</span>
                    <span className="rounded-md border border-terminal-border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                      {c.category}
                    </span>
                  </div>
                  <p className="text-xs text-terminal-muted mt-1 max-w-2xl">{c.description}</p>
                </div>
                <StatusSelect value={c.status} onChange={(s) => setStatus(c, s)} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AppPage>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: AssessmentStatus;
  onChange: (s: AssessmentStatus) => void;
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AssessmentStatus)}
        className={`appearance-none cursor-pointer pl-2.5 pr-7 py-1 rounded-md border font-mono text-xs uppercase ${STATUS_STYLES[value]}`}
        aria-label="Control status"
      >
        {ASSESSMENT_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-terminal-dark text-terminal-text normal-case">
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
    </div>
  );
}
