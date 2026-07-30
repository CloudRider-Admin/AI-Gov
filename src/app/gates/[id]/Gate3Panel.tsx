"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, XCircle, Lock, ListChecks, CalendarClock, Info } from "lucide-react";
import { GATE_SPECS, requiresApproval, riskSeverity } from "@/lib/gates/gateEnums";
import { APPROVAL_LABELS, APPROVAL_STYLES } from "@/components/gates/gateStyles";
import type {
  ApprovalEligibilityView,
  GateRecordView,
  GateSystemView,
  OpenTaskView,
} from "@/components/gates/types";
import { Badge, Detail, PanelHeader } from "./GateDetailClient";

export function Gate3Panel({
  system,
  record,
  approval,
  openTasks,
  onDecision,
}: {
  system: GateSystemView;
  record?: GateRecordView;
  approval: ApprovalEligibilityView | null;
  openTasks: OpenTaskView[];
  onDecision: (updated: Partial<GateSystemView>) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);

  const required = requiresApproval(system.riskCategory);
  const canApprove = approval?.eligible ?? false;

  const decide = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && note.trim().length < 10) {
      setError("A rejection needs a note of at least 10 characters explaining the decision.");
      return;
    }
    setBusy(decision);
    setError(null);
    setReasons([]);
    try {
      const res = await fetch(`/api/ai-systems/${system.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReasons(data.reasons ?? []);
        throw new Error(data.error ?? "Failed to record the decision");
      }
      onDecision({
        approvalStatus: data.system.approvalStatus,
        approvedByName: data.system.approvedByName,
        approvedAt: data.system.approvedAt,
        approvalNote: data.system.approvalNote,
        approvalExpiresAt: data.system.approvalExpiresAt,
      });
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the decision");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="glass-card rounded-xl p-6">
      <PanelHeader title={GATE_SPECS[3].name} purpose={GATE_SPECS[3].purpose} record={record} />

      {/* Approval requirement */}
      <div className="rounded-lg border border-terminal-border p-4 mb-6">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-terminal-cyan shrink-0 mt-0.5" />
          <div className="text-sm text-terminal-text">
            {required ? (
              <>
                This {system.entityKind} is tiered{" "}
                <span className="font-mono">{system.riskCategory}</span> risk, which maps to{" "}
                <span className="font-mono">{riskSeverity(system.riskCategory)}</span> severity.
                Approval is required for medium risk and above, so a named decision has to be
                recorded before it goes to production.
              </>
            ) : (
              <>
                This {system.entityKind} is tiered{" "}
                <span className="font-mono">{system.riskCategory}</span> risk, which maps to{" "}
                <span className="font-mono">{riskSeverity(system.riskCategory)}</span> severity.
                Approval is only required at medium risk and above, so no decision is needed — it is
                registered as-is.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Current decision */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-terminal-border">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-wider text-terminal-muted mb-1">
            Approval status
          </dt>
          <dd>
            <Badge className={APPROVAL_STYLES[system.approvalStatus]}>
              {APPROVAL_LABELS[system.approvalStatus]}
            </Badge>
          </dd>
        </div>
        <Detail label="Approved by" value={system.approvedByName || "—"} />
        <Detail
          label="Decision date"
          value={system.approvedAt ? new Date(system.approvedAt).toLocaleDateString() : "—"}
        />
        <Detail
          label="Valid until"
          value={
            system.approvalExpiresAt
              ? new Date(system.approvalExpiresAt).toLocaleDateString()
              : "—"
          }
        />
      </div>

      {system.approvalNote && (
        <div className="mb-6">
          <h3 className="font-mono text-xs uppercase tracking-wider text-terminal-muted mb-2">
            Decision note
          </h3>
          <p className="text-sm text-terminal-text border-l-2 border-terminal-border pl-3">
            {system.approvalNote}
          </p>
        </div>
      )}

      {system.approvalExpiresAt &&
        system.approvalStatus === "approved" &&
        new Date(system.approvalExpiresAt).getTime() < Date.now() && (
          <div className="flex items-start gap-2 rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 p-3 mb-6">
            <CalendarClock className="w-4 h-4 text-terminal-amber shrink-0 mt-0.5" />
            <p className="text-sm text-terminal-text">
              This approval lapsed on{" "}
              {new Date(system.approvalExpiresAt).toLocaleDateString()}. Re-evaluate and record a
              fresh decision.
            </p>
          </div>
        )}

      {/* Blockers */}
      {required && !canApprove && (
        <div className="rounded-lg border border-terminal-border p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-terminal-amber" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-terminal-amber">
              Approval is held
            </h3>
          </div>
          <ul className="space-y-1.5">
            {(approval?.reasons ?? []).map((reason) => (
              <li key={reason} className="text-sm text-terminal-text">
                {reason}
              </li>
            ))}
          </ul>

          {openTasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-terminal-border">
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-4 h-4 text-terminal-muted" />
                <span className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  Open remediation
                </span>
              </div>
              <ul className="space-y-1.5 mb-3">
                {openTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-[10px] uppercase text-terminal-muted w-14 shrink-0">
                      {task.priority}
                    </span>
                    <span className="text-terminal-text">{task.title}</span>
                  </li>
                ))}
              </ul>
              <Link href="/tasks" className="btn-secondary text-sm py-1.5 inline-flex">
                Go to remediation
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Decision form */}
      {required && (
        <div>
          <h3 className="font-mono text-xs uppercase tracking-wider text-terminal-muted mb-3">
            Record a decision
          </h3>

          {error && (
            <p className="text-sm text-terminal-red font-mono border border-terminal-red/40 rounded-md px-3 py-2 mb-3">
              {error}
            </p>
          )}
          {reasons.length > 0 && (
            <ul className="mb-3 space-y-1">
              {reasons.map((reason) => (
                <li key={reason} className="text-sm text-terminal-amber">
                  {reason}
                </li>
              ))}
            </ul>
          )}

          <label className="block mb-3">
            <span className="font-mono text-xs text-terminal-muted mb-1.5 block">
              Decision note {canApprove ? "(optional for approval, required to reject)" : "(required to reject)"}
            </span>
            <textarea
              className="input-field min-h-[80px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What the decision rests on, and any conditions attached to it."
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => decide("approved")}
              disabled={!canApprove || busy !== null}
              className="btn-primary text-sm py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title={canApprove ? undefined : "Clear the blocking items before approving"}
            >
              <BadgeCheck className="w-4 h-4" />
              {busy === "approved" ? "Recording…" : "Approve"}
            </button>
            <button
              onClick={() => decide("rejected")}
              disabled={busy !== null}
              className="btn-secondary text-sm py-2"
            >
              <XCircle className="w-4 h-4" />
              {busy === "rejected" ? "Recording…" : "Reject"}
            </button>
          </div>

          <p className="text-xs text-terminal-muted mt-3 max-w-2xl">
            Approval is recorded only after remediation completes. Rejection stays available
            throughout — an approver must be able to say no while work is still outstanding.
          </p>
        </div>
      )}
    </section>
  );
}
