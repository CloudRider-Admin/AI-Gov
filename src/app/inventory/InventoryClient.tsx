"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ShieldAlert, Server, Clock, X, Pencil, Archive, BadgeCheck, ArrowRight } from "lucide-react";
import { RISK_CATEGORIES, LIFECYCLE_STAGES } from "@/lib/governanceEnums";
import {
  ENTITY_KINDS,
  ENTITY_KIND_LABELS,
  requiresApproval,
  type EntityKind,
} from "@/lib/gates/gateEnums";
import {
  APPROVAL_LABELS,
  APPROVAL_STYLES,
  GATE_STATUS_LABELS,
  GATE_STATUS_STYLES,
  RISK_STYLES,
  STAGE_LABELS,
} from "@/components/gates/gateStyles";

export interface AiSystemView {
  id: string;
  name: string;
  entityKind: string;
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
  approvalStatus: string;
  approvedByName: string | null;
  approvedAt: string | null;
  approvalExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  gateRecords: { gate: number; status: string }[];
}

interface Summary {
  total: number;
  byRisk: Record<string, number>;
  byKind: Record<string, number>;
  byApproval: Record<string, number>;
  reviewOverdue: number;
  neverReviewed: number;
  approvalExpired: number;
}

type FormState = Partial<AiSystemView> & { dataTypesText?: string };
type KindFilter = "all" | EntityKind;

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
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const visible = useMemo(
    () => (kindFilter === "all" ? systems : systems.filter((s) => s.entityKind === kindFilter)),
    [systems, kindFilter],
  );

  const recomputeSummary = (next: AiSystemView[]): Summary => {
    const byRisk: Record<string, number> = { prohibited: 0, high: 0, limited: 0, minimal: 0 };
    const byKind: Record<string, number> = { "use-case": 0, agent: 0, model: 0 };
    const byApproval: Record<string, number> = {
      "not-required": 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    let reviewOverdue = 0;
    let neverReviewed = 0;
    let approvalExpired = 0;
    const now = Date.now();

    for (const s of next) {
      byRisk[s.riskCategory] = (byRisk[s.riskCategory] ?? 0) + 1;
      byKind[s.entityKind] = (byKind[s.entityKind] ?? 0) + 1;
      byApproval[s.approvalStatus] = (byApproval[s.approvalStatus] ?? 0) + 1;
      if (!s.lastReviewedAt) neverReviewed += 1;
      if (s.nextReviewAt && new Date(s.nextReviewAt).getTime() < now) reviewOverdue += 1;
      if (
        s.approvalStatus === "approved" &&
        s.approvalExpiresAt &&
        new Date(s.approvalExpiresAt).getTime() < now
      ) {
        approvalExpired += 1;
      }
    }

    return {
      total: next.length,
      byRisk,
      byKind,
      byApproval,
      reviewOverdue,
      neverReviewed,
      approvalExpired,
    };
  };

  const openCreate = () => {
    setError(null);
    setEditing({
      entityKind: "use-case",
      riskCategory: "limited",
      lifecycleStage: "idea",
      dataTypesText: "",
    });
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
      entityKind: editing.entityKind ?? "use-case",
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
      // The write path returns the row without its gate records; keep whatever
      // we already had so the progress bar does not blink to empty.
      const view: AiSystemView = {
        ...system,
        gateRecords: system.gateRecords ?? editing.gateRecords ?? [],
      };
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
              Every use case, agent, and model your organization runs, risk-tiered against the EU AI
              Act, with the approval decision and review cadence auditors can trust.
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary text-sm py-2">
            <Plus className="w-4 h-4" /> Register entity
          </button>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <SummaryCard icon={<Server className="w-4 h-4" />} label="Registered" value={summary.total} />
          <SummaryCard
            icon={<ShieldAlert className="w-4 h-4 text-terminal-red" />}
            label="High / prohibited"
            value={(summary.byRisk.high ?? 0) + (summary.byRisk.prohibited ?? 0)}
          />
          <SummaryCard
            icon={<BadgeCheck className="w-4 h-4 text-terminal-amber" />}
            label="Awaiting approval"
            value={summary.byApproval.pending ?? 0}
          />
          <SummaryCard
            icon={<BadgeCheck className="w-4 h-4 text-terminal-green" />}
            label="Approved"
            value={summary.byApproval.approved ?? 0}
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4 text-terminal-amber" />}
            label="Review overdue"
            value={summary.reviewOverdue}
          />
        </div>

        {/* Entity kind filter */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            All ({systems.length})
          </FilterChip>
          {ENTITY_KINDS.map((kind) => (
            <FilterChip
              key={kind}
              active={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
            >
              {ENTITY_KIND_LABELS[kind]}s ({summary.byKind[kind] ?? 0})
            </FilterChip>
          ))}
          <Link
            href="/gates"
            className="ml-auto font-mono text-xs text-terminal-green hover:underline inline-flex items-center gap-1"
          >
            View gate pipeline <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Table */}
        {systems.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Server className="w-10 h-10 text-terminal-muted mx-auto mb-4" />
            <p className="font-mono text-terminal-text mb-2">Nothing registered yet</p>
            <p className="text-terminal-muted text-sm mb-6">
              Start your register by adding the use cases, agents, and models your team runs.
            </p>
            <button onClick={openCreate} className="btn-primary text-sm py-2">
              <Plus className="w-4 h-4" /> Register your first entity
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <p className="font-mono text-terminal-text mb-2">
              No {ENTITY_KIND_LABELS[kindFilter as EntityKind]?.toLowerCase()}s registered
            </p>
            <button onClick={openCreate} className="btn-secondary text-sm py-2 mt-2">
              <Plus className="w-4 h-4" /> Register one
            </button>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead>
                  <tr className="border-b border-terminal-border font-mono text-[11px] uppercase tracking-wider text-terminal-muted">
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Kind</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Owner</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Gates</th>
                    <th className="px-4 py-3">Approval</th>
                    <th className="px-4 py-3 hidden xl:table-cell">Next review</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => {
                    const overdue = s.nextReviewAt && new Date(s.nextReviewAt).getTime() < Date.now();
                    const expired =
                      s.approvalStatus === "approved" &&
                      s.approvalExpiresAt &&
                      new Date(s.approvalExpiresAt).getTime() < Date.now();

                    return (
                      <tr key={s.id} className="border-b border-terminal-border/50 hover:bg-terminal-gray/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/gates/${s.id}`}
                            className="font-mono text-sm text-terminal-text hover:text-terminal-green"
                          >
                            {s.name}
                          </Link>
                          {s.vendor && <div className="text-xs text-terminal-muted">{s.vendor}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] uppercase tracking-wider text-terminal-muted">
                            {ENTITY_KIND_LABELS[s.entityKind as EntityKind] ?? s.entityKind}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-sm text-terminal-muted">
                          {s.businessOwner || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={RISK_STYLES[s.riskCategory] ?? RISK_STYLES.minimal}>
                            {s.riskCategory}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <GateProgress records={s.gateRecords} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={APPROVAL_STYLES[s.approvalStatus]}>
                            {APPROVAL_LABELS[s.approvalStatus]}
                          </Badge>
                          {s.approvedByName && (
                            <div className="text-[11px] text-terminal-muted mt-1">
                              {s.approvedByName}
                              {s.approvedAt ? ` · ${new Date(s.approvedAt).toLocaleDateString()}` : ""}
                            </div>
                          )}
                          {expired && (
                            <div className="text-[11px] text-terminal-amber mt-1">Lapsed</div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-sm">
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
                {editing.id ? "Edit entity" : "Register entity"}
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

              <Field label="Entity kind *">
                <div className="grid grid-cols-3 gap-2">
                  {ENTITY_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setEditing({ ...editing, entityKind: kind })}
                      aria-pressed={editing.entityKind === kind}
                      className={`px-2 py-2 rounded-md border font-mono text-xs transition-colors ${
                        editing.entityKind === kind
                          ? "border-terminal-green text-terminal-green bg-terminal-green/10"
                          : "border-terminal-border text-terminal-muted hover:text-terminal-text"
                      }`}
                    >
                      {ENTITY_KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Name *">
                <input
                  className="input-field"
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder={
                    editing.entityKind === "agent"
                      ? "e.g. Invoice reconciliation agent"
                      : editing.entityKind === "model"
                        ? "e.g. gpt-4o (production deployment)"
                        : "e.g. Customer support copilot"
                  }
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

              {editing.riskCategory && (
                <p className="text-xs text-terminal-muted border-l-2 border-terminal-border pl-3">
                  {requiresApproval(editing.riskCategory)
                    ? "This tier requires a named approval decision at Gate 3 before production."
                    : "This tier sits below the approval threshold — no decision is required at Gate 3."}
                </p>
              )}

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
                  {saving ? "Saving…" : editing.id ? "Save changes" : "Register entity"}
                </button>
                <button onClick={() => setEditing(null)} className="btn-secondary text-sm py-2">
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

function GateProgress({ records }: { records: { gate: number; status: string }[] }) {
  return (
    <div className="flex items-center gap-1 w-24" aria-label="Gate progress">
      {[1, 2, 3].map((gate) => {
        const status = records.find((r) => r.gate === gate)?.status ?? "not-started";
        return (
          <span
            key={gate}
            title={`Gate ${gate}: ${GATE_STATUS_LABELS[status] ?? status}`}
            className={`h-1.5 flex-1 rounded-full border ${
              GATE_STATUS_STYLES[status] ?? GATE_STATUS_STYLES["not-started"]
            }`}
          />
        );
      })}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border font-mono text-[11px] uppercase ${className}`}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-xs text-terminal-muted mb-1.5 block">{label}</span>
      {children}
    </label>
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
