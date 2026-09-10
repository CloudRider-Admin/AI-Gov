"use client";

import { useCallback, useEffect, useState } from "react";
import { X, CheckCircle2, Circle, FileCheck2, ShieldCheck, Trash2 } from "lucide-react";
import {
  APPROVAL_STATUSES,
  EVALUATION_SOURCES,
  EVALUATION_SOURCE_LABELS,
  requiresApproval,
  type EvaluationSource,
} from "@/lib/governanceEnums";
import {
  CORE_EVALUATION_PARAMETERS,
  getEvaluationParameter,
} from "@/data/coreEvaluationParameters";
import { ApprovalPill, RiskPill } from "@/components/app";
import { useDialog } from "@/lib/hooks/useDialog";
import type { AiSystemView } from "./InventoryClient";

interface EvidenceView {
  id: string;
  reviewArea: string;
  source: string;
  metric: string | null;
  result: string;
  meetsBaseline: boolean | null;
  notes: string | null;
  evaluatedAt: string;
}

interface AreaFindingView {
  id: string;
  reviewArea: string;
  baseline: string;
  critical: boolean;
  status: "meets-baseline" | "below-baseline" | "inconclusive" | "not-evaluated";
  evidenceCount: number;
}

interface ReportView {
  id: string;
  verdict: string;
  summary: string;
  areaFindings: AreaFindingView[];
  evidenceCount: number;
  generatedBy: string | null;
  createdAt: string;
}

const VERDICT_STYLES: Record<string, string> = {
  pass: "text-terminal-green border-terminal-green/40 bg-terminal-green/10",
  "conditional-pass": "text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10",
  fail: "text-terminal-red border-terminal-red/40 bg-terminal-red/10",
};

const AREA_STATUS_LABELS: Record<AreaFindingView["status"], string> = {
  "meets-baseline": "Meets baseline",
  "below-baseline": "Below baseline",
  inconclusive: "Inconclusive",
  "not-evaluated": "Not evaluated",
};

const AREA_STATUS_STYLES: Record<AreaFindingView["status"], string> = {
  "meets-baseline": "text-terminal-green",
  "below-baseline": "text-terminal-red",
  inconclusive: "text-terminal-amber",
  "not-evaluated": "text-terminal-muted",
};

interface EvidenceForm {
  reviewArea: string;
  source: EvaluationSource;
  metric: string;
  result: string;
  meetsBaseline: "yes" | "no" | "unjudged";
  notes: string;
}

const EMPTY_EVIDENCE: EvidenceForm = {
  reviewArea: CORE_EVALUATION_PARAMETERS[0].id,
  source: "data-science",
  metric: "",
  result: "",
  meetsBaseline: "unjudged",
  notes: "",
};

/**
 * Per-entry governance gates panel:
 *  Gate 1 — Intake & Risk Classification (derived from registry fields)
 *  Gate 2 — Evaluation & Review (evidence + evidence report vs Core Evaluation Parameters)
 *  Gate 3 — Approval & Registry (Approved / Pending / Rejected, medium+high risk only)
 */
export function GatesDrawer({
  system,
  onClose,
  onSystemChange,
}: {
  system: AiSystemView;
  onClose: () => void;
  onSystemChange: (next: AiSystemView) => void;
}) {
  const [evidence, setEvidence] = useState<EvidenceView[]>([]);
  const [reports, setReports] = useState<ReportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EvidenceForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  /** Why /approval refused the decision — surfaced verbatim, they are written as sentences. */
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  // Escape to close, Tab trapped inside, focus returned to the row that opened it.
  const dialogRef = useDialog<HTMLDivElement>(onClose);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, repRes] = await Promise.all([
        fetch(`/api/ai-systems/${system.id}/evaluations`),
        fetch(`/api/ai-systems/${system.id}/evidence-report`),
      ]);
      if (evRes.ok) setEvidence((await evRes.json()).evidence);
      if (repRes.ok) setReports((await repRes.json()).reports);
    } finally {
      setLoading(false);
    }
  }, [system.id]);

  useEffect(() => {
    load();
  }, [load]);

  const addEvidence = async () => {
    if (!form?.result.trim()) {
      setError("Result is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-systems/${system.id}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewArea: form.reviewArea,
          source: form.source,
          metric: form.metric.trim() || null,
          result: form.result,
          meetsBaseline: form.meetsBaseline === "unjudged" ? null : form.meetsBaseline === "yes",
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save");
      const { evidence: created } = await res.json();
      setEvidence((prev) => [created, ...prev]);
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save evidence");
    } finally {
      setBusy(false);
    }
  };

  const removeEvidence = async (id: string) => {
    const res = await fetch(`/api/ai-systems/${system.id}/evaluations/${id}`, { method: "DELETE" });
    if (res.ok) setEvidence((prev) => prev.filter((e) => e.id !== id));
  };

  const generateReport = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-systems/${system.id}/evidence-report`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate report");
      const { report } = await res.json();
      setReports((prev) => [report, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Gate 3 decisions go through /approval, the one path that enforces the exit
   * criteria (Gate 2 cleared, remediation closed). When it refuses, it returns
   * the specific reasons, which are far more useful to the user than "Failed".
   */
  const setApproval = async (status: (typeof APPROVAL_STATUSES)[number]) => {
    setBusy(true);
    setError(null);
    setBlockedReasons([]);
    try {
      const res = await fetch(`/api/ai-systems/${system.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: status, note: approvalNote.trim() || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBlockedReasons(Array.isArray(payload.reasons) ? payload.reasons : []);
        throw new Error(payload.error ?? "Failed to record the decision");
      }
      onSystemChange(payload.system);
      setApprovalNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update approval");
    } finally {
      setBusy(false);
    }
  };

  const latestReport = reports[0];
  const gate1Items: Array<[string, boolean]> = [
    ["Registered in the AI System Registry", true],
    ["Purpose documented", Boolean(system.purpose?.trim())],
    ["Business owner named", Boolean(system.businessOwner?.trim())],
    ["Data types documented", system.dataTypes.length > 0],
    ["Risk tier assigned", Boolean(system.riskCategory)],
  ];
  const gate1Complete = gate1Items.every(([, done]) => done);
  const needsApproval = requiresApproval(system.riskCategory);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gates-drawer-title"
        tabIndex={-1}
        className="w-full max-w-2xl h-full bg-terminal-dark border-l border-terminal-border overflow-y-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-terminal-border bg-terminal-dark p-4">
          <div className="min-w-0">
            <h2 id="gates-drawer-title" className="font-mono text-terminal-text truncate">
              Governance gates — {system.name}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <RiskPill risk={system.riskCategory} />
              <ApprovalPill status={system.approvalStatus} />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/*
            The only feedback channel in the drawer. Announced live, because a
            screen-reader user gets no other signal that a save was refused.
          */}
          <div role="alert" aria-live="assertive" className={error ? undefined : "sr-only"}>
            {error && (
              <p className="text-sm text-terminal-red font-mono border border-terminal-red/40 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* ── Gate 1 ── */}
          <section className="glass rounded-xl p-4">
            <GateHeading
              n={1}
              title="Intake & Risk Classification"
              done={gate1Complete}
              hint={gate1Complete ? "Complete" : "Incomplete — edit the registry entry"}
            />
            <ul className="mt-3 space-y-1.5">
              {gate1Items.map(([label, done]) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-terminal-green shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-terminal-muted shrink-0" />
                  )}
                  <span className={done ? "text-terminal-text" : "text-terminal-muted"}>{label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Gate 2 ── */}
          <section className="glass rounded-xl p-4">
            <GateHeading
              n={2}
              title="Evaluation & Review"
              done={latestReport?.verdict === "pass"}
              hint={
                latestReport
                  ? `Latest report: ${latestReport.verdict}`
                  : "No evidence report yet"
              }
            />
            <p className="mt-2 text-xs text-terminal-muted">
              Collect evaluation results from data science, engineering, and red-team (curated from
              the AI platform in use). GovSecure reviews the evidence against the Core Evaluation
              Parameters baseline and produces an evidence report.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setForm(form ? null : { ...EMPTY_EVIDENCE })}
                className="btn-secondary text-xs py-1.5"
              >
                {form ? "Cancel" : "Add evaluation result"}
              </button>
              <button
                onClick={generateReport}
                disabled={busy || evidence.length === 0}
                className="btn-primary text-xs py-1.5 disabled:opacity-50"
              >
                <FileCheck2 className="w-3.5 h-3.5" /> Generate evidence report
              </button>
              <span className="font-mono text-xs text-terminal-muted">
                {loading ? "Loading…" : `${evidence.length} result(s) collected`}
              </span>
            </div>

            {form && (
              <div className="mt-3 space-y-3 rounded-lg border border-terminal-border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Review area</span>
                    <select
                      className="input-field"
                      value={form.reviewArea}
                      onChange={(e) => setForm({ ...form, reviewArea: e.target.value })}
                    >
                      {CORE_EVALUATION_PARAMETERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.reviewArea}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Source</span>
                    <select
                      className="input-field"
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as EvaluationSource })}
                    >
                      {EVALUATION_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {EVALUATION_SOURCE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="font-mono text-[11px] leading-relaxed text-terminal-muted">
                  Baseline: {getEvaluationParameter(form.reviewArea)?.baseline}
                </p>
                <label className="block">
                  <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Metric (optional)</span>
                  <input
                    className="input-field"
                    value={form.metric}
                    onChange={(e) => setForm({ ...form, metric: e.target.value })}
                    placeholder="e.g. hallucination rate, attack success rate"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Result *</span>
                  <textarea
                    className="input-field min-h-[64px]"
                    value={form.result}
                    onChange={(e) => setForm({ ...form, result: e.target.value })}
                    placeholder="Observed evaluation result, e.g. 96% grounded across 500 sampled answers"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-xs text-terminal-muted mb-1.5 block">Meets governance baseline?</span>
                  <select
                    className="input-field"
                    value={form.meetsBaseline}
                    onChange={(e) =>
                      setForm({ ...form, meetsBaseline: e.target.value as EvidenceForm["meetsBaseline"] })
                    }
                  >
                    <option value="unjudged">Not yet judged</option>
                    <option value="yes">Yes — meets baseline</option>
                    <option value="no">No — below baseline</option>
                  </select>
                </label>
                <button onClick={addEvidence} disabled={busy} className="btn-primary text-xs py-1.5">
                  {busy ? "Saving…" : "Save evidence"}
                </button>
              </div>
            )}

            {evidence.length > 0 && (
              <ul className="mt-3 space-y-2">
                {evidence.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-terminal-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="text-terminal-text">
                          {getEvaluationParameter(e.reviewArea)?.reviewArea ?? e.reviewArea}
                        </span>
                        <span className="text-terminal-muted">
                          {EVALUATION_SOURCE_LABELS[e.source as EvaluationSource] ?? e.source}
                        </span>
                        {e.meetsBaseline !== null && (
                          <span className={e.meetsBaseline ? "text-terminal-green" : "text-terminal-red"}>
                            {e.meetsBaseline ? "meets baseline" : "below baseline"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-terminal-muted break-words">
                        {e.metric ? `${e.metric}: ` : ""}
                        {e.result}
                      </p>
                    </div>
                    <button
                      onClick={() => removeEvidence(e.id)}
                      aria-label="Delete evidence"
                      className="p-1.5 rounded-md text-terminal-muted hover:text-terminal-red hover:bg-terminal-gray shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {latestReport && (
              <div className="mt-4 rounded-lg border border-terminal-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
                    Latest evidence report
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${
                      VERDICT_STYLES[latestReport.verdict] ?? VERDICT_STYLES["conditional-pass"]
                    }`}
                  >
                    {latestReport.verdict}
                  </span>
                </div>
                <p className="mt-2 text-sm text-terminal-muted">{latestReport.summary}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-terminal-border font-mono uppercase tracking-wider text-terminal-muted">
                        <th className="py-1.5 pr-3 font-semibold">Review area</th>
                        <th className="py-1.5 pr-3 font-semibold">Evidence</th>
                        <th className="py-1.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestReport.areaFindings.map((a) => (
                        <tr key={a.id} className="border-b border-terminal-border/40 last:border-b-0">
                          <td className="py-1.5 pr-3 text-terminal-text">
                            {a.reviewArea}
                            {a.critical && <span className="text-terminal-red"> *</span>}
                          </td>
                          <td className="py-1.5 pr-3 font-mono tabular-nums text-terminal-muted">
                            {a.evidenceCount}
                          </td>
                          <td className={`py-1.5 font-mono ${AREA_STATUS_STYLES[a.status]}`}>
                            {AREA_STATUS_LABELS[a.status]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 font-mono text-[11px] text-terminal-muted">
                    * critical area — below-baseline fails the report. Generated by{" "}
                    {latestReport.generatedBy ?? "—"} on{" "}
                    {new Date(latestReport.createdAt).toLocaleDateString()}.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── Gate 3 ── */}
          <section className="glass rounded-xl p-4">
            <GateHeading
              n={3}
              title="Approval & Registry"
              done={system.approvalStatus === "approved"}
              hint={
                needsApproval
                  ? system.approvalStatus === "approved"
                    ? `Approved by ${system.approvedBy ?? "—"}`
                    : system.approvalStatus === "rejected"
                      ? `Rejected by ${system.approvedBy ?? "—"}`
                      : "Awaiting decision"
                  : "Not required for low risk"
              }
            />
            {needsApproval ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-terminal-muted">
                  Medium and high risk agents, models, and use-cases require an approval decision
                  after remediation is complete. The decision and approver are recorded in the
                  registry and audit trail.
                </p>
                {(system.approvalStatus === "approved" || system.approvalStatus === "rejected") && (
                  <p className="font-mono text-xs text-terminal-muted">
                    {system.approvalStatus === "approved" ? "Approved" : "Rejected"} by{" "}
                    <span className="text-terminal-text">{system.approvedBy ?? "—"}</span>
                    {system.approvedAt
                      ? ` on ${new Date(system.approvedAt).toLocaleDateString()}`
                      : ""}
                    {system.approvalNote ? ` — “${system.approvalNote}”` : ""}
                  </p>
                )}
                {blockedReasons.length > 0 && (
                  <div
                    className="rounded-md border border-terminal-amber/40 bg-terminal-amber/5 px-3 py-2"
                    role="alert"
                  >
                    <p className="font-mono text-xs text-terminal-amber mb-1.5">
                      This entry cannot be approved yet:
                    </p>
                    <ul className="space-y-1">
                      {blockedReasons.map((reason) => (
                        <li key={reason} className="text-xs text-terminal-text">
                          — {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <label className="block">
                  <span className="font-mono text-xs text-terminal-muted mb-1.5 block">
                    Decision note{" "}
                    <span className="text-terminal-muted/70">
                      (required to reject or withdraw — at least 10 characters)
                    </span>
                  </span>
                  <input
                    className="input-field"
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    placeholder="e.g. Remediation of security findings verified"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setApproval("approved")}
                    disabled={busy || system.approvalStatus === "approved"}
                    className="btn-primary text-xs py-1.5 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => setApproval("rejected")}
                    disabled={busy || system.approvalStatus === "rejected"}
                    className="btn-secondary text-xs py-1.5 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setApproval("pending")}
                    disabled={busy || system.approvalStatus === "pending"}
                    className="btn-secondary text-xs py-1.5 disabled:opacity-50"
                  >
                    Withdraw decision
                  </button>
                </div>
                <p className="text-xs text-terminal-muted">
                  Approval is recorded only once Gate 2 has cleared and remediation is closed. A
                  rejection can always be recorded.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-terminal-muted">
                This entry is low risk — Gate 3 approval only applies to medium and high risk
                entries. Raise the risk tier if the impact profile changes.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function GateHeading({
  n,
  title,
  done,
  hint,
}: {
  n: number;
  title: string;
  done: boolean;
  hint: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-mono text-sm text-terminal-text">
        <span className="text-terminal-muted">Gate {n} · </span>
        {title}
      </h3>
      <span
        className={`font-mono text-xs ${done ? "text-terminal-green" : "text-terminal-muted"}`}
      >
        {hint}
      </span>
    </div>
  );
}
