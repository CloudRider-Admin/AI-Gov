"use client";

import { useState } from "react";
import { Plus, X, Trash2, Calendar, AlertTriangle } from "lucide-react";
import { TASK_STATUSES, TASK_PRIORITIES, type TaskStatus, type TaskPriority } from "@/lib/governanceEnums";
import { AppPage, PageHeader } from "@/components/app";

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  aiSystemId: string | null;
  framework: string | null;
  controlId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-terminal-muted",
  medium: "text-terminal-green",
  high: "text-terminal-amber",
  critical: "text-terminal-red",
};

type Draft = { title: string; description: string; priority: TaskPriority; dueDate: string };

export function TasksClient({ initialTasks }: { initialTasks: TaskView[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>({ title: "", description: "", priority: "medium", dueDate: "" });
  const [saving, setSaving] = useState(false);

  const columns: TaskStatus[] = [...TASK_STATUSES];

  const create = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || null,
          priority: draft.priority,
          dueDate: draft.dueDate || null,
        }),
      });
      if (res.ok) {
        const { task } = await res.json();
        setTasks((prev) => [task, ...prev]);
        setDraft({ title: "", description: "", priority: "medium", dueDate: "" });
        setCreating(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const move = async (task: TaskView, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status, completedAt: status === "done" ? new Date().toISOString() : null } : t)),
    );
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const remove = async (task: TaskView) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
  };

  const nextStatus = (status: string): TaskStatus | null => {
    const idx = columns.indexOf(status as TaskStatus);
    return idx >= 0 && idx < columns.length - 1 ? columns[idx + 1] : null;
  };
  const prevStatus = (status: string): TaskStatus | null => {
    const idx = columns.indexOf(status as TaskStatus);
    return idx > 0 ? columns[idx - 1] : null;
  };

  return (
    <AppPage>
      <PageHeader
        eyebrow="Governance / Remediation"
        title="Remediation Tasks"
        description="Turn compliance gaps into tracked, assignable work. Move tasks across the board as you close them."
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary text-sm py-2">
            <Plus className="w-4 h-4" /> New task
          </button>
        }
      />

        {creating && (
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm text-terminal-text">New remediation task</h2>
              <button onClick={() => setCreating(false)} aria-label="Close" className="text-terminal-muted hover:text-terminal-text">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <input
                className="input-field"
                placeholder="Task title *"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <textarea
                className="input-field min-h-[64px]"
                placeholder="Description (optional)"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="input-field"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p} priority
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="input-field"
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={create} disabled={saving} className="btn-primary text-sm py-2">
                  {saving ? "Adding…" : "Add task"}
                </button>
                <button onClick={() => setCreating(false)} className="btn-secondary text-sm py-2">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kanban board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col);
            return (
              <div key={col} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between px-1 mb-3">
                  <span className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
                    {STATUS_LABELS[col]}
                  </span>
                  <span className="font-mono text-xs text-terminal-muted">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.length === 0 && (
                    <p className="text-xs text-terminal-muted px-1 py-6 text-center">No tasks</p>
                  )}
                  {colTasks.map((t) => {
                    const overdue = t.status !== "done" && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
                    const back = prevStatus(t.status);
                    const fwd = nextStatus(t.status);
                    return (
                      <div key={t.id} className="rounded-md border border-terminal-border bg-terminal-black/40 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-terminal-text">{t.title}</span>
                          <button
                            onClick={() => remove(t)}
                            aria-label="Delete task"
                            className="text-terminal-muted hover:text-terminal-red shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {t.description && <p className="text-xs text-terminal-muted mt-1">{t.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs font-mono">
                          <span className={PRIORITY_STYLES[t.priority] ?? ""}>{t.priority}</span>
                          {t.dueDate && (
                            <span className={`flex items-center gap-1 ${overdue ? "text-terminal-amber" : "text-terminal-muted"}`}>
                              {overdue ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                              {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-3">
                          {back && (
                            <button
                              onClick={() => move(t, back)}
                              className="flex-1 py-1 rounded-md border border-terminal-border text-xs font-mono text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray"
                            >
                              ← {STATUS_LABELS[back]}
                            </button>
                          )}
                          {fwd && (
                            <button
                              onClick={() => move(t, fwd)}
                              className="flex-1 py-1 rounded-md border border-terminal-green/40 text-xs font-mono text-terminal-green hover:bg-terminal-green/10"
                            >
                              {STATUS_LABELS[fwd]} →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
    </AppPage>
  );
}
