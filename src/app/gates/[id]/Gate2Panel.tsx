"use client";

import { useState } from "react";
import {
  Upload,
  Plus,
  Sparkles,
  FileText,
  Trash2,
  Terminal,
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react";
import { CORE_EVALUATION_PARAMETERS, EVALUATOR_TEAMS } from "@/lib/gates/coreEvaluationParameters";
import { GATE_SPECS } from "@/lib/gates/gateEnums";
import {
  EVALUATOR_TEAM_LABELS,
  SEVERITY_STYLES,
  VERDICT_LABELS,
  VERDICT_STYLES,
} from "@/components/gates/gateStyles";
import type { EvaluationRunView, GateRecordView, GateSystemView } from "@/components/gates/types";
import { Badge, PanelHeader } from "./GateDetailClient";

type Tab = "runs" | "baselines" | "api";

interface ManualRow {
  area: string;
  parameter: string;
  metricValue: string;
  unit: string;
  textValue: string;
  sampleSize: string;
}

const EMPTY_ROW: ManualRow = {
  area: CORE_EVALUATION_PARAMETERS[0].id,
  parameter: "",
  metricValue: "",
  unit: "",
  textValue: "",
  sampleSize: "",
};

export function Gate2Panel({
  system,
  record,
  runs,
  onRunsChange,
  onGateChange,
}: {
  system: GateSystemView;
  record?: GateRecordView;
  runs: EvaluationRunView[];
  onRunsChange: (runs: EvaluationRunView[]) => void;
  onGateChange: () => void;
}) {
  const [tab, setTab] = useState<Tab>("runs");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(runs[0]?.id ?? null);

  return (
    <section className="glass-card rounded-xl p-6">
      <PanelHeader title={GATE_SPECS[2].name} purpose={GATE_SPECS[2].purpose} record={record} />

      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-terminal-border pb-4">
        <TabButton active={tab === "runs"} onClick={() => setTab("runs")}>
          Evaluation runs ({runs.length})
        </TabButton>
        <TabButton active={tab === "baselines"} onClick={() => setTab("baselines")}>
          Core evaluation parameters
        </TabButton>
        <TabButton active={tab === "api"} onClick={() => setTab("api")}>
          Pipeline ingestion
        </TabButton>

        <div className="ml-auto">
          <button onClick={() => setCreating(true)} className="btn-primary text-sm py-2">
            <Plus className="w-4 h-4" /> New run
          </button>
        </div>
      </div>

      {tab === "runs" && (
        <RunsTab
          runs={runs}
          expanded={expanded}
          setExpanded={setExpanded}
          onRunsChange={onRunsChange}
          onGateChange={onGateChange}
        />
      )}
      {tab === "baselines" && <BaselinesTab />}
      {tab === "api" && <ApiTab systemId={system.id} />}

      {creating && (
        <NewRunDrawer
          systemId={system.id}
          onClose={() => setCreating(false)}
          onCreated={(run) => {
            onRunsChange([run, ...runs]);
            setExpanded(run.id);
            setCreating(false);
            setTab("runs");
            onGateChange();
          }}
        />
      )}
    </section>
  );
}

// ─── Runs ───────────────────────────────────────────────────────────────────

function RunsTab({
  runs,
  expanded,
  setExpanded,
  onRunsChange,
  onGateChange,
}: {
  runs: EvaluationRunView[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onRunsChange: (runs: EvaluationRunView[]) => void;
  onGateChange: () => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-terminal-border p-10 text-center">
        <FileText className="w-8 h-8 text-terminal-muted mx-auto mb-3" />
        <p className="font-mono text-terminal-text mb-1.5">No evaluation evidence yet</p>
        <p className="text-terminal-muted text-sm max-w-md mx-auto">
          Open a run, then bring in the results your data science, engineering, or red team produced
          on the AI platform you evaluate on — by file, by hand, or straight from your pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <RunCard
          key={run.id}
          run={run}
          expanded={expanded === run.id}
          onToggle={() => setExpanded(expanded === run.id ? null : run.id)}
          onUpdated={(updated) => onRunsChange(runs.map((r) => (r.id === updated.id ? updated : r)))}
          onDeleted={() => {
            onRunsChange(runs.filter((r) => r.id !== run.id));
            onGateChange();
          }}
          onGateChange={onGateChange}
        />
      ))}
    </div>
  );
}

function RunCard({
  run,
  expanded,
  onToggle,
  onUpdated,
  onDeleted,
  onGateChange,
}: {
  run: EvaluationRunView;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: (run: EvaluationRunView) => void;
  onDeleted: () => void;
  onGateChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const reload = async () => {
    const res = await fetch(`/api/evaluations/${run.id}`);
    if (res.ok) {
      const data = await res.json();
      onUpdated(normalizeRun(data.run));
    }
  };

  const upload = async (file: File) => {
    setBusy("upload");
    setError(null);
    setWarnings([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/evaluations/${run.id}/evidence`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setWarnings(data.warnings ?? []);
      await reload();
      onGateChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const review = async () => {
    setBusy("review");
    setError(null);
    try {
      const res = await fetch(`/api/evaluations/${run.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createTasks: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      if (data.degraded) {
        setWarnings([
          "The AI service was unavailable, so the report was written from the scored evidence alone. Verdicts are unaffected.",
        ]);
      }
      await reload();
      onGateChange();
      setShowReport(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete evaluation run "${run.runLabel}"? Its evidence and report go with it.`)) return;
    setBusy("delete");
    const res = await fetch(`/api/evaluations/${run.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) onDeleted();
  };

  const downloadReport = () => {
    if (!run.reportMarkdown) return;
    const blob = new Blob([run.reportMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `evidence-report-${run.runLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-terminal-border overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-terminal-gray/30"
      >
        <div className="flex items-start gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-terminal-muted shrink-0 mt-1" />
          ) : (
            <ChevronRight className="w-4 h-4 text-terminal-muted shrink-0 mt-1" />
          )}
          <div className="min-w-0">
            <div className="font-mono text-sm text-terminal-text">{run.runLabel}</div>
            <div className="text-xs text-terminal-muted mt-0.5">
              {run.evaluatorTeam ? EVALUATOR_TEAM_LABELS[run.evaluatorTeam] ?? run.evaluatorTeam : "Unattributed"}
              {run.platform ? ` · ${run.platform}` : ""}
              {` · ${run.results.length} result${run.results.length === 1 ? "" : "s"}`}
              {run.coverageRatio !== null ? ` · ${Math.round(run.coverageRatio * 100)}% coverage` : ""}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          {run.overallVerdict ? (
            <Badge className={VERDICT_STYLES[run.overallVerdict] ?? VERDICT_STYLES["not-assessed"]}>
              {VERDICT_LABELS[run.overallVerdict] ?? run.overallVerdict}
            </Badge>
          ) : (
            <Badge className={VERDICT_STYLES["not-assessed"]}>
              {run.status === "ingested" ? "Awaiting review" : "Draft"}
            </Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-terminal-border p-4 space-y-4">
          {error && (
            <p className="text-sm text-terminal-red font-mono border border-terminal-red/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {warnings.map((warning) => (
            <p
              key={warning}
              className="text-sm text-terminal-amber border border-terminal-amber/40 rounded-md px-3 py-2"
            >
              {warning}
            </p>
          ))}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary text-sm py-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              {busy === "upload" ? "Ingesting…" : "Upload results"}
              <input
                type="file"
                accept=".json,.csv,.md,.markdown,application/json,text/csv,text/markdown"
                className="sr-only"
                disabled={busy !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
            </label>

            <button
              onClick={() => setShowManual((v) => !v)}
              className="btn-secondary text-sm py-2"
              disabled={busy !== null}
            >
              <Plus className="w-4 h-4" /> Enter by hand
            </button>

            <button
              onClick={review}
              disabled={busy !== null || run.results.length === 0}
              className="btn-primary text-sm py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title={run.results.length === 0 ? "Attach evidence before requesting a review" : undefined}
            >
              <Sparkles className="w-4 h-4" />
              {busy === "review" ? "Govi is reviewing…" : run.reportMarkdown ? "Re-review" : "Review with Govi"}
            </button>

            {run.reportMarkdown && (
              <>
                <button onClick={() => setShowReport((v) => !v)} className="btn-secondary text-sm py-2">
                  <FileText className="w-4 h-4" /> {showReport ? "Hide" : "View"} evidence report
                </button>
                <button onClick={downloadReport} className="btn-secondary text-sm py-2">
                  <Download className="w-4 h-4" /> Export
                </button>
              </>
            )}

            <button
              onClick={remove}
              disabled={busy !== null}
              aria-label={`Delete run ${run.runLabel}`}
              className="ml-auto p-2 rounded-md text-terminal-muted hover:text-terminal-red hover:bg-terminal-gray"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {showManual && (
            <ManualEntry
              runId={run.id}
              onSaved={async (warns) => {
                setWarnings(warns);
                setShowManual(false);
                await reload();
                onGateChange();
              }}
            />
          )}

          {run.results.length > 0 && <ResultsTable run={run} />}

          {showReport && run.reportMarkdown && (
            <div className="rounded-lg border border-terminal-border bg-terminal-gray/30 p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs text-terminal-text leading-relaxed overflow-x-auto">
                {run.reportMarkdown}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsTable({ run }: { run: EvaluationRunView }) {
  // Group by review area so the table reads in the same order as the baseline
  // standard rather than in ingestion order.
  const byArea = new Map<string, typeof run.results>();
  for (const result of run.results) {
    const list = byArea.get(result.area) ?? [];
    list.push(result);
    byArea.set(result.area, list);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-terminal-border">
      <table className="w-full text-left min-w-[640px]">
        <thead>
          <tr className="border-b border-terminal-border font-mono text-[11px] uppercase tracking-wider text-terminal-muted">
            <th className="px-3 py-2">Review area</th>
            <th className="px-3 py-2">Parameter</th>
            <th className="px-3 py-2 text-right">Result</th>
            <th className="px-3 py-2">Verdict</th>
            <th className="px-3 py-2">Gap</th>
          </tr>
        </thead>
        <tbody>
          {CORE_EVALUATION_PARAMETERS.filter((spec) => byArea.has(spec.id)).map((spec) =>
            byArea.get(spec.id)!.map((result, i) => (
              <tr key={result.id} className="border-b border-terminal-border/50">
                <td className="px-3 py-2 text-sm text-terminal-muted">
                  {i === 0 ? spec.label : ""}
                </td>
                <td className="px-3 py-2 text-sm text-terminal-text">{result.parameter}</td>
                <td className="px-3 py-2 text-sm text-terminal-text text-right font-mono whitespace-nowrap">
                  {result.metricValue !== null
                    ? `${result.metricValue}${result.unit ? ` ${result.unit}` : ""}`
                    : (result.textValue ?? "—")}
                  {result.sampleSize ? (
                    <span className="text-terminal-muted"> (n={result.sampleSize})</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Badge className={VERDICT_STYLES[result.verdict] ?? VERDICT_STYLES["not-assessed"]}>
                    {VERDICT_LABELS[result.verdict] ?? result.verdict}
                  </Badge>
                </td>
                <td className={`px-3 py-2 text-xs ${SEVERITY_STYLES[result.severity] ?? "text-terminal-muted"}`}>
                  {result.gap ?? "—"}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Manual entry ───────────────────────────────────────────────────────────

function ManualEntry({
  runId,
  onSaved,
}: {
  runId: string;
  onSaved: (warnings: string[]) => void;
}) {
  const [rows, setRows] = useState<ManualRow[]>([{ ...EMPTY_ROW }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, patch: Partial<ManualRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const save = async () => {
    const payload = rows
      .filter((row) => row.parameter.trim() && (row.metricValue.trim() || row.textValue.trim()))
      .map((row) => ({
        area: row.area,
        parameter: row.parameter.trim(),
        metricValue: row.metricValue.trim() || null,
        unit: row.unit || null,
        textValue: row.textValue.trim() || null,
        sampleSize: row.sampleSize.trim() || null,
      }));

    if (payload.length === 0) {
      setError("Add at least one row with a parameter and either a value or an observation.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluations/${runId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved(data.warnings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-terminal-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-terminal-muted max-w-xl">
          Saving replaces every result on this run, so enter the full set. Leave the value blank and
          write an observation instead where the area is judged qualitatively.
        </p>
      </div>

      {error && (
        <p className="text-sm text-terminal-red font-mono border border-terminal-red/40 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <select
              aria-label="Review area"
              className="input-field md:col-span-3 text-sm"
              value={row.area}
              onChange={(e) => update(i, { area: e.target.value })}
            >
              {CORE_EVALUATION_PARAMETERS.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Parameter"
              className="input-field md:col-span-3 text-sm"
              placeholder="Parameter, e.g. hallucination rate"
              value={row.parameter}
              onChange={(e) => update(i, { parameter: e.target.value })}
            />
            <input
              aria-label="Value"
              className="input-field md:col-span-2 text-sm"
              placeholder="Value"
              value={row.metricValue}
              onChange={(e) => update(i, { metricValue: e.target.value })}
            />
            <select
              aria-label="Unit"
              className="input-field md:col-span-2 text-sm"
              value={row.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
            >
              <option value="">No unit</option>
              <option value="percent">percent</option>
              <option value="score-5">score /5</option>
              <option value="count">count</option>
              <option value="ms">ms</option>
              <option value="ratio">ratio</option>
            </select>
            <input
              aria-label="Sample size"
              className="input-field md:col-span-2 text-sm"
              placeholder="n"
              value={row.sampleSize}
              onChange={(e) => update(i, { sampleSize: e.target.value })}
            />
            <input
              aria-label="Observation"
              className="input-field md:col-span-12 text-sm"
              placeholder="Observation (used when there is no number to report)"
              value={row.textValue}
              onChange={(e) => update(i, { textValue: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
          className="btn-secondary text-sm py-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add row
        </button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm py-1.5">
          {saving ? "Saving…" : "Save evidence"}
        </button>
      </div>
    </div>
  );
}

// ─── Baselines reference ────────────────────────────────────────────────────

function BaselinesTab() {
  return (
    <div>
      <p className="text-sm text-terminal-muted mb-4 max-w-3xl">
        Every run is judged against these baselines. Verdicts are set arithmetically before Govi
        writes the report, so the narrative can explain a result but never overturn one.
      </p>
      <div className="overflow-x-auto rounded-lg border border-terminal-border">
        <table className="w-full text-left min-w-[720px]">
          <thead>
            <tr className="border-b border-terminal-border font-mono text-[11px] uppercase tracking-wider text-terminal-muted">
              <th className="px-3 py-2">Review area</th>
              <th className="px-3 py-2">Parameters examined</th>
              <th className="px-3 py-2">Governance baseline</th>
            </tr>
          </thead>
          <tbody>
            {CORE_EVALUATION_PARAMETERS.map((spec) => (
              <tr key={spec.id} className="border-b border-terminal-border/50 align-top">
                <td className="px-3 py-2.5 text-sm text-terminal-text font-mono whitespace-nowrap">
                  {spec.label}
                </td>
                <td className="px-3 py-2.5 text-sm text-terminal-muted">
                  {spec.parameters.join(", ")}
                </td>
                <td className="px-3 py-2.5 text-sm text-terminal-text">{spec.baseline.expectation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pipeline ingestion ─────────────────────────────────────────────────────

function ApiTab({ systemId }: { systemId: string }) {
  const snippet = `curl -X POST https://<your-host>/api/evaluations/ingest \\
  -H "Authorization: Bearer $GOVSECURE_INGEST_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "aiSystemId": "${systemId}",
    "runLabel": "nightly-eval-2026-07-30",
    "evaluatorTeam": "red-team",
    "platform": "Azure AI Foundry",
    "autoReview": true,
    "results": [
      { "area": "security", "parameter": "prompt injection ASR", "value": "0%" },
      { "area": "safety",   "parameter": "severe violations",    "value": 0 },
      { "area": "factual-reliability", "parameter": "groundedness", "value": "96%" }
    ]
  }'`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-terminal-muted max-w-3xl">
        Push results straight from your eval harness after each run. Posting the same{" "}
        <code className="font-mono text-terminal-text">runLabel</code> twice replaces that
        run&apos;s evidence rather than duplicating it, so a retried pipeline step converges. With{" "}
        <code className="font-mono text-terminal-text">autoReview</code> on, the response carries
        the verdict — enough for a build to fail itself on a governance failure.
      </p>

      <div className="rounded-lg border border-terminal-border bg-terminal-gray/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-terminal-green" />
          <span className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
            Ingestion request
          </span>
        </div>
        <pre className="font-mono text-xs text-terminal-text leading-relaxed overflow-x-auto">
          {snippet}
        </pre>
      </div>

      <p className="text-xs text-terminal-muted">
        Tokens are minted and revoked at{" "}
        <code className="font-mono text-terminal-text">/api/ingest-tokens</code>. The plaintext is
        returned once at creation and is not recoverable afterwards.
      </p>
    </div>
  );
}

// ─── New run drawer ─────────────────────────────────────────────────────────

function NewRunDrawer({
  systemId,
  onClose,
  onCreated,
}: {
  systemId: string;
  onClose: () => void;
  onCreated: (run: EvaluationRunView) => void;
}) {
  const [form, setForm] = useState({
    runLabel: "",
    evaluatorTeam: "data-science",
    evaluatorName: "",
    platform: "",
    evaluatedAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.runLabel.trim()) {
      setError("A run label is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiSystemId: systemId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create the run");
      onCreated(normalizeRun(data.run));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the run");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-terminal-dark border-l border-terminal-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-terminal-border">
          <h2 className="font-mono text-terminal-text">New evaluation run</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <p className="text-sm text-terminal-red font-mono border border-terminal-red/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Field label="Run label *">
            <input
              className="input-field"
              value={form.runLabel}
              onChange={(e) => setForm({ ...form, runLabel: e.target.value })}
              placeholder="e.g. redteam-2026-07-30"
            />
          </Field>
          <Field label="Evaluating team">
            <select
              className="input-field"
              value={form.evaluatorTeam}
              onChange={(e) => setForm({ ...form, evaluatorTeam: e.target.value })}
            >
              {EVALUATOR_TEAMS.map((team) => (
                <option key={team} value={team}>
                  {EVALUATOR_TEAM_LABELS[team]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Evaluator name">
            <input
              className="input-field"
              value={form.evaluatorName}
              onChange={(e) => setForm({ ...form, evaluatorName: e.target.value })}
              placeholder="Who ran it"
            />
          </Field>
          <Field label="AI platform used">
            <input
              className="input-field"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              placeholder="e.g. Azure AI Foundry, Bedrock, internal harness"
            />
          </Field>
          <Field label="Evaluation date">
            <input
              type="date"
              className="input-field"
              value={form.evaluatedAt}
              onChange={(e) => setForm({ ...form, evaluatedAt: e.target.value })}
            />
          </Field>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving} className="btn-primary text-sm py-2 flex-1">
              {saving ? "Creating…" : "Create run"}
            </button>
            <button onClick={onClose} className="btn-secondary text-sm py-2">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** API rows come back with Date-shaped strings and no results array on create. */
function normalizeRun(raw: Record<string, unknown>): EvaluationRunView {
  const results = Array.isArray(raw.results) ? (raw.results as EvaluationRunView["results"]) : [];
  return {
    id: String(raw.id),
    runLabel: String(raw.runLabel),
    source: String(raw.source ?? "manual"),
    evaluatorTeam: (raw.evaluatorTeam as string) ?? null,
    evaluatorName: (raw.evaluatorName as string) ?? null,
    platform: (raw.platform as string) ?? null,
    status: String(raw.status ?? "draft"),
    overallVerdict: (raw.overallVerdict as string) ?? null,
    reviewSummary: (raw.reviewSummary as string) ?? null,
    reportMarkdown: (raw.reportMarkdown as string) ?? null,
    coverageRatio: typeof raw.coverageRatio === "number" ? raw.coverageRatio : null,
    evaluatedAt: raw.evaluatedAt ? String(raw.evaluatedAt) : null,
    reviewedAt: raw.reviewedAt ? String(raw.reviewedAt) : null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    results,
  };
}

function TabButton({
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-xs text-terminal-muted mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
