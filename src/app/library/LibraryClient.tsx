"use client";

import { useState } from "react";
import { FileText, Download, CheckCircle2, Send, RotateCcw, Clock, BrainCircuit, Trash2 } from "lucide-react";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/governanceEnums";

interface UserDocView {
  id: string;
  fileName: string;
  framework: string | null;
  chunkCount: number;
  createdAt: string;
}

interface ArtifactView {
  id: string;
  type: string;
  subType: string | null;
  title: string;
  riskTier: string | null;
  useCaseName: string | null;
  reviewStatus: string;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_META: Record<ReviewStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-terminal-muted/15 text-terminal-muted border-terminal-border" },
  "in-review": { label: "In review", className: "bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40" },
  approved: { label: "Approved", className: "bg-terminal-green/15 text-terminal-green border-terminal-green/40" },
};

// The next action available from each status.
const NEXT_ACTION: Record<ReviewStatus, { to: ReviewStatus; label: string; icon: typeof Send } | null> = {
  draft: { to: "in-review", label: "Submit for review", icon: Send },
  "in-review": { to: "approved", label: "Approve", icon: CheckCircle2 },
  approved: null,
};

const FILTERS: ("all" | ReviewStatus)[] = ["all", ...REVIEW_STATUSES];

export function LibraryClient({
  initialArtifacts,
  initialUserDocs = [],
}: {
  initialArtifacts: ArtifactView[];
  initialUserDocs?: UserDocView[];
}) {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [userDocs, setUserDocs] = useState(initialUserDocs);
  const [filter, setFilter] = useState<"all" | ReviewStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const deleteDoc = async (id: string) => {
    if (!confirm("Remove this document from your knowledge base? The advisor will no longer reference it.")) return;
    setUserDocs((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/user-documents/${id}`, { method: "DELETE" });
  };

  const setStatus = async (a: ArtifactView, status: ReviewStatus) => {
    setBusy(a.id);
    setArtifacts((prev) =>
      prev.map((x) =>
        x.id === a.id
          ? { ...x, reviewStatus: status, reviewedAt: status === "approved" ? new Date().toISOString() : null }
          : x,
      ),
    );
    await fetch(`/api/artifacts/${a.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
  };

  const counts = REVIEW_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: artifacts.filter((a) => a.reviewStatus === s).length }),
    {} as Record<ReviewStatus, number>,
  );

  const visible = filter === "all" ? artifacts : artifacts.filter((a) => a.reviewStatus === filter);

  return (
    <div className="section min-h-screen">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 block">
            Governance / Documents
          </span>
          <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-3">
            Document Library
          </h1>
          <p className="text-terminal-muted font-sans max-w-2xl">
            Every governance document you&apos;ve generated, with a sign-off workflow so policies
            move from draft to approved with an auditable trail.
          </p>
        </header>

        {/* Knowledge base — uploaded documents the advisor retrieves from (RAG) */}
        {userDocs.length > 0 && (
          <div className="glass-card rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="w-4 h-4 text-terminal-green" />
              <h2 className="font-mono text-sm text-terminal-text">Your knowledge base</h2>
              <span className="font-mono text-xs text-terminal-muted">
                — Govi cites these in its answers
              </span>
            </div>
            <ul className="divide-y divide-terminal-border/50">
              {userDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-terminal-text truncate">{d.fileName}</div>
                    <div className="text-xs text-terminal-muted mt-0.5">
                      {d.chunkCount} chunk{d.chunkCount === 1 ? "" : "s"}
                      {d.framework && d.framework !== "Combined" ? ` · ${d.framework}` : ""} ·{" "}
                      {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDoc(d.id)}
                    className="text-terminal-muted hover:text-terminal-red shrink-0 ml-3"
                    aria-label={`Remove ${d.fileName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider border transition-colors ${
                filter === f
                  ? "border-terminal-green/50 text-terminal-green bg-terminal-green/10"
                  : "border-terminal-border text-terminal-muted hover:text-terminal-text"
              }`}
            >
              {f === "all" ? `All (${artifacts.length})` : `${STATUS_META[f].label} (${counts[f] ?? 0})`}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <FileText className="w-10 h-10 text-terminal-muted mx-auto mb-4" />
            <p className="font-mono text-terminal-text mb-1">No documents here</p>
            <p className="text-terminal-muted text-sm">
              Generate governance documents from the Govi advisor to populate your library.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((a) => {
              const status = (STATUS_META[a.reviewStatus as ReviewStatus] ? a.reviewStatus : "draft") as ReviewStatus;
              const action = NEXT_ACTION[status];
              const ActionIcon = action?.icon;
              return (
                <div key={a.id} className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
                  <FileText className="w-5 h-5 text-terminal-green shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm text-terminal-text truncate">{a.title}</div>
                    <div className="flex items-center gap-2 text-xs text-terminal-muted mt-0.5">
                      <span className="uppercase">{a.subType || a.type}</span>
                      {a.riskTier && <span>· {a.riskTier} risk</span>}
                      {a.reviewedAt && (
                        <span className="flex items-center gap-1">
                          · <Clock className="w-3 h-3" /> approved {new Date(a.reviewedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-block px-2 py-0.5 rounded-md border font-mono text-[11px] uppercase ${STATUS_META[status].className}`}
                  >
                    {STATUS_META[status].label}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`/api/artifacts/${a.id}/export`}
                      className="p-2 rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray"
                      aria-label="Export document"
                      title="Export"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {action && ActionIcon && (
                      <button
                        onClick={() => setStatus(a, action.to)}
                        disabled={busy === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-terminal-green/40 text-terminal-green text-xs font-mono hover:bg-terminal-green/10 disabled:opacity-50"
                      >
                        <ActionIcon className="w-3.5 h-3.5" /> {action.label}
                      </button>
                    )}
                    {status !== "draft" && (
                      <button
                        onClick={() => setStatus(a, "draft")}
                        disabled={busy === a.id}
                        className="p-2 rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray disabled:opacity-50"
                        aria-label="Reopen as draft"
                        title="Reopen as draft"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
