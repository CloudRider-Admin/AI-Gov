"use client";

import { useState } from "react";
import { Plus, ShieldAlert, Server, Clock, X, Pencil, Archive } from "lucide-react";
import { RISK_CATEGORIES, LIFECYCLE_STAGES } from "@/lib/governanceEnums";

export interface AiSystemView {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  businessOwner: string | null;
  vendor: string | null;
  model: string | null;
  lifecycleStage: string;
  riskCategory: string;
  status: string;
  dataTypes: string[];
  deployedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  total: number;
  byRisk: Record<string, number>;
  reviewOverdue: number;
  neverReviewed: number;
}

const RISK_STYLES: Record<string, string> = {
  prohibited: "bg-terminal-red/15 text-terminal-red border-terminal-red/40",
  high: "bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40",
  limited: "bg-terminal-green/15 text-terminal-green border-terminal-green/40",
  minimal: "bg-terminal-muted/15 text-terminal-muted border-terminal-border",
};

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  piloting: "Piloting",
  production: "Production",
  retired: "Retired",
};

type FormState = Partial<AiSystemView> & { dataTypesText?: string };

export function InventoryClient({
  initialSystems,
  summary: initialSummary,
}: {
  initialSystems: AiSystemView[];
  summary: Summary;
}) {
  const [systems, setSystems] = useState(initialSystems);
  const [summary, setSummary] = useState(initialSummary);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recomputeSummary = (next: AiSystemView[]): Summary => {
    const byRisk: Record<string, number> = { prohibited: 0, high: 0, limited: 0, minimal: 0 };
    let reviewOverdue = 0;
    let neverReviewed = 0;
    const now = Date.now();
    for (const s of next) {
      byRisk[s.riskCategory] = (byRisk[s.riskCategory] ?? 0) + 1;
      if (!s.lastReviewedAt) neverReviewed += 1;
      if (s.nextReviewAt && new Date(s.nextReviewAt).getTime() < now) reviewOverdue += 1;
    }
    return { total: next.length, byRisk, reviewOverdue, neverReviewed };
  };

  const openCreate = () => {
    setError(null);
    setEditing({ riskCategory: "limited", lifecycleStage: "idea", dataTypesText: "" });
  };

  const openEdit = (s: AiSystemView) => {
    setError(null);
    setEditing({ ...s, dataTypesText: s.dataTypes.join(", ") });
  };

  const save = async () => {
    if (!editing?.name?.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: editing.name,
      description: editing.description ?? null,
      purpose: editing.purpose ?? null,
      businessOwner: editing.businessOwner ?? null,
      vendor: editing.vendor ?? null,
      model: editing.model ?? null,
      lifecycleStage: editing.lifecycleStage,
      riskCategory: editing.riskCategory,
      dataTypes: (editing.dataTypesText ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      nextReviewAt: editing.nextReviewAt ?? null,
      deployedAt: editing.deployedAt ?? null,
    };

    try {
      const isEdit = Boolean(editing.id);
      const res = await fetch(isEdit ? `/api/ai-systems/${editing.id}` : "/api/ai-systems", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      const { system } = await res.json();
      const view: AiSystemView = system;
      const next = isEdit
        ? systems.map((s) => (s.id === view.id ? view : s))
        : [view, ...systems];
      setSystems(next);
      setSummary(recomputeSummary(next));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (s: AiSystemView) => {
    if (!confirm(`Archive "${s.name}"? It will be removed from the active register.`)) return;
    const res = await fetch(`/api/ai-systems/${s.id}`, { method: "DELETE" });
    if (res.ok) {
      const next = systems.filter((x) => x.id !== s.id);
      setSystems(next);
      setSummary(recomputeSummary(next));
    }
  };

  return (
    <div className="section min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 block">
              Governance / Inventory
            </span>
            <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-3">
              AI System Register
            </h1>
            <p className="text-terminal-muted font-sans max-w-2xl">
              Every AI system your organization runs, risk-tiered against the EU AI Act with a
              review cadence auditors can trust.
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary text-sm py-2">
            <Plus className="w-4 h-4" /> Register system
          </button>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <SummaryCard icon={<Server className="w-4 h-4" />} label="Systems" value={summary.total} />
          <SummaryCard
            icon={<ShieldAlert className="w-4 h-4 text-terminal-red" />}
            label="High / prohibited"
            value={(summary.byRisk.high ?? 0) + (summary.byRisk.prohibited ?? 0)}
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4 text-terminal-amber" />}
            label="Review overdue"
            value={summary.reviewOverdue}
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4 text-terminal-muted" />}
            label="Never reviewed"
            value={summary.neverReviewed}
          />
        </div>

        {/* Table */}
        {systems.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Server className="w-10 h-10 text-terminal-muted mx-auto mb-4" />
            <p className="font-mono text-terminal-text mb-2">No AI systems registered yet</p>
            <p className="text-terminal-muted text-sm mb-6">
              Start your register by adding the AI tools and models your team uses.
            </p>
            <button onClick={openCreate} className="btn-primary text-sm py-2">
              <Plus className="w-4 h-4" /> Register your first system
            </button>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-terminal-border font-mono text-[11px] uppercase tracking-wider text-terminal-muted">
                  <th className="px-4 py-3">System</th>
                  <th className="px-4 py-3 hidden md:table-cell">Owner</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Stage</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Next review</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {systems.map((s) => {
                  const overdue = s.nextReviewAt && new Date(s.nextReviewAt).getTime() < Date.now();
                  return (
                    <tr key={s.id} className="border-b border-terminal-border/50 hover:bg-terminal-gray/30">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm text-terminal-text">{s.name}</div>
                        {s.vendor && <div className="text-xs text-terminal-muted">{s.vendor}</div>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-terminal-muted">
                        {s.businessOwner || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border font-mono text-[11px] uppercase ${
                            RISK_STYLES[s.riskCategory] ?? RISK_STYLES.minimal
                          }`}
                        >
                          {s.riskCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-sm text-terminal-muted">
                        {STAGE_LABELS[s.lifecycleStage] ?? s.lifecycleStage}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm">
                        {s.nextReviewAt ? (
                          <span className={overdue ? "text-terminal-amber" : "text-terminal-muted"}>
                            {new Date(s.nextReviewAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-terminal-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            aria-label={`Edit ${s.name}`}
                            className="p-1.5 rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => archive(s)}
                            aria-label={`Archive ${s.name}`}
                            className="p-1.5 rounded-md text-terminal-muted hover:text-terminal-red hover:bg-terminal-gray"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setEditing(null)}>
          <div
            className="w-full max-w-md h-full bg-terminal-dark border-l border-terminal-border overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-terminal-border">
              <h2 className="font-mono text-terminal-text">
                {editing.id ? "Edit system" : "Register AI system"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="p-1.5 rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <p className="text-sm text-terminal-red font-mono border border-terminal-red/40 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Field label="Name *">
                <input
                  className="input-field"
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Customer support copilot"
                />
              </Field>
              <Field label="Purpose">
                <textarea
                  className="input-field min-h-[72px]"
                  value={editing.purpose ?? ""}
                  onChange={(e) => setEditing({ ...editing, purpose: e.target.value })}
                  placeholder="What business problem does it solve?"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Business owner">
                  <input
                    className="input-field"
                    value={editing.businessOwner ?? ""}
                    onChange={(e) => setEditing({ ...editing, businessOwner: e.target.value })}
                  />
                </Field>
                <Field label="Vendor / model">
                  <input
                    className="input-field"
                    value={editing.vendor ?? ""}
                    onChange={(e) => setEditing({ ...editing, vendor: e.target.value })}
                    placeholder="OpenAI, Anthropic…"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Risk category">
                  <select
                    className="input-field"
                    value={editing.riskCategory ?? "limited"}
                    onChange={(e) => setEditing({ ...editing, riskCategory: e.target.value })}
                  >
                    {RISK_CATEGORIES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Lifecycle stage">
                  <select
                    className="input-field"
                    value={editing.lifecycleStage ?? "idea"}
                    onChange={(e) => setEditing({ ...editing, lifecycleStage: e.target.value })}
                  >
                    {LIFECYCLE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Data types processed (comma-separated)">
                <input
                  className="input-field"
                  value={editing.dataTypesText ?? ""}
                  onChange={(e) => setEditing({ ...editing, dataTypesText: e.target.value })}
                  placeholder="PII, financial, health"
                />
              </Field>
              <Field label="Next review date">
                <input
                  type="date"
                  className="input-field"
                  value={editing.nextReviewAt ? editing.nextReviewAt.slice(0, 10) : ""}
                  onChange={(e) => setEditing({ ...editing, nextReviewAt: e.target.value || null })}
                />
              </Field>

              <div className="flex gap-2 pt-2">
                <button onClick={save} disabled={saving} className="btn-primary text-sm py-2 flex-1">
                  {saving ? "Saving…" : editing.id ? "Save changes" : "Register system"}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="btn-secondary text-sm py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-xs text-terminal-muted mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
