"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  ScanSearch,
  FileSignature,
  X,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  ArrowRight,
} from "lucide-react";

// ─── Shared types ─────────────────────────────────────────────────────────────

interface AdvisorApiResult {
  riskProfile?: { level?: string; description?: string; reasoning?: string[] };
  suggestedPolicies?: { title?: string; description?: string }[];
  executiveSummary?: string;
  summary?: string;
  riskLevel?: string;
  topRisks?: string[];
}

const riskColorMap: Record<string, string> = {
  low: "text-terminal-green border-terminal-green/30 bg-terminal-green/10",
  medium: "text-terminal-amber border-terminal-amber/30 bg-terminal-amber/10",
  high: "text-terminal-red border-terminal-red/30 bg-terminal-red/10",
  critical: "text-terminal-red border-terminal-red/40 bg-terminal-red/15",
};

function badgeClass(level: string) {
  return riskColorMap[level?.toLowerCase()] ?? "text-terminal-muted border-terminal-border bg-terminal-gray/30";
}

// ─── Shared modal shell ───────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-xl"} bg-terminal-black border border-terminal-border rounded-xl shadow-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
            <span className="font-mono text-sm font-semibold text-terminal-text">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Shared input form ────────────────────────────────────────────────────────

function UseCaseForm({
  label,
  cta,
  loading,
  error,
  onSubmit,
}: {
  label: string;
  cta: string;
  loading: boolean;
  error: string | null;
  onSubmit: (query: string) => void;
}) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length >= 10) onSubmit(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-sans text-terminal-muted leading-relaxed">{label}</p>
      <div className="flex items-start gap-2">
        <span className="font-mono text-terminal-green mt-2">{">"}</span>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 2000))}
          placeholder='e.g. "We use an LLM to screen CVs for our hiring pipeline..."'
          className="flex-grow bg-terminal-dark border border-terminal-border rounded-md px-3 py-2 text-sm font-mono text-terminal-text placeholder:text-terminal-muted resize-none min-h-[120px] outline-none focus:border-terminal-green/50 transition-colors"
          disabled={loading}
        />
      </div>
      {error && (
        <div className="flex items-start gap-2 text-terminal-red text-sm font-sans">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-terminal-muted">
          {query.length > 0 ? `${query.length}/2000 chars` : "No sign-up required"}
        </span>
        <button
          type="submit"
          disabled={loading || query.trim().length < 10}
          className="btn-primary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {cta}...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {cta}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Intake Popup (Card 01) ───────────────────────────────────────────────────

function IntakePopup({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Analysis failed. Please try again.");
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const level = result?.riskProfile?.level ?? result?.riskLevel ?? "";

  return (
    <Modal title="AI Governance Intake" onClose={onClose}>
      {!result ? (
        <UseCaseForm
          label="Describe the AI system, model, or feature you're planning. Govi will instantly assess governance risks and surface relevant frameworks."
          cta="Analyze"
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-mono font-semibold ${badgeClass(level)}`}>
            <CheckCircle className="w-4 h-4" />
            Risk Level: {level || "Unknown"}
          </div>

          {result.riskProfile?.description && (
            <p className="text-sm font-sans text-terminal-text leading-relaxed">
              {result.riskProfile.description}
            </p>
          )}

          {result.riskProfile?.reasoning && result.riskProfile.reasoning.length > 0 && (
            <div>
              <p className="font-mono text-xs text-terminal-muted uppercase tracking-wider mb-2">Key Risks</p>
              <ul className="space-y-1">
                {result.riskProfile.reasoning.slice(0, 4).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-sans text-terminal-text">
                    <span className="text-terminal-red font-mono mt-0.5">▸</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.suggestedPolicies && result.suggestedPolicies.length > 0 && (
            <div>
              <p className="font-mono text-xs text-terminal-muted uppercase tracking-wider mb-2">Suggested Policies</p>
              <ul className="space-y-1">
                {result.suggestedPolicies.slice(0, 2).map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-sans text-terminal-text">
                    <span className="text-terminal-green font-mono mt-0.5">▸</span>
                    {p.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-terminal-border">
            <button
              onClick={() => setResult(null)}
              className="btn-secondary text-sm py-2"
            >
              New Analysis
            </button>
            <Link href="/govi" className="btn-primary text-sm py-2">
              Full Advisor <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── DPIA Popup (Card 03) ─────────────────────────────────────────────────────

function buildDPIA(useCase: string, result: AdvisorApiResult): string {
  const level = result.riskProfile?.level ?? result.riskLevel ?? "Unknown";
  const desc = result.riskProfile?.description ?? result.executiveSummary ?? result.summary ?? "";
  const risks = result.riskProfile?.reasoning ?? result.topRisks ?? [];
  const policies = result.suggestedPolicies ?? [];

  const today = new Date().toISOString().split("T")[0];

  return `DATA PROTECTION IMPACT ASSESSMENT (DPIA)
Generated by GovSecure · ${today}
─────────────────────────────────────────────────────────────

1. DESCRIPTION OF PROCESSING
${useCase}

2. NECESSITY & PROPORTIONALITY
This AI system must be evaluated for necessity and proportionality of data
processing. Confirm that the identified processing operations are limited to
what is necessary to achieve the stated purpose.

3. RISK ASSESSMENT
Overall Risk Level: ${level.toUpperCase()}
${desc ? `\nAssessment Summary:\n${desc}` : ""}
${risks.length > 0 ? `\nIdentified Risks:\n${risks.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}` : ""}

4. MITIGATION MEASURES
${policies.length > 0
  ? policies.map((p, i) => `  ${i + 1}. ${p.title}${p.description ? `\n     ${p.description}` : ""}`).join("\n")
  : "  1. Implement data minimisation — collect only what is strictly necessary.\n  2. Apply access controls and audit logging to all AI model outputs.\n  3. Establish a human review process for high-risk decisions."}

5. CONSULTATION & APPROVAL
□ DPO / Privacy team consulted
□ Legal review completed
□ Stakeholder sign-off obtained
□ Supervisory authority consulted (if required)

6. REVIEW & UPDATE COMMITMENT
This DPIA will be reviewed when the processing activity changes materially,
and at a minimum annually. Next review date: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}

─────────────────────────────────────────────────────────────
Generated free by GovSecure · govsecure.ai
For a full AI-assisted DPIA visit: /govi
`;
}

function DPIAPopup({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dpia, setDpia] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(query: string) {
    setLoading(true);
    setError(null);
    setDpia(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `Generate a DPIA for: ${query}` }),
      });
      if (!res.ok) throw new Error("Generation failed. Please try again.");
      const data: AdvisorApiResult = await res.json();
      setDpia(buildDPIA(query, data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!dpia) return;
    navigator.clipboard.writeText(dpia);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!dpia) return;
    const blob = new Blob([dpia], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "DPIA-GovSecure.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title="Generate Free DPIA" onClose={onClose} wide>
      {!dpia ? (
        <UseCaseForm
          label="Describe your AI use case. GovSecure will generate a structured Data Protection Impact Assessment (DPIA) you can download immediately — no account needed."
          cta="Generate DPIA"
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-terminal-green" />
              <span className="font-mono text-sm text-terminal-green font-semibold">DPIA Generated</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-terminal-green/15 text-terminal-green border border-terminal-green/30">
                FREE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                className="btn-primary text-xs py-1.5 px-3"
              >
                <Download className="w-3.5 h-3.5" />
                Download .txt
              </button>
            </div>
          </div>

          <pre className="bg-terminal-dark border border-terminal-border rounded-md p-4 text-xs font-mono text-terminal-text leading-relaxed overflow-y-auto max-h-72 whitespace-pre-wrap">
            {dpia}
          </pre>

          <div className="flex items-center gap-3 pt-2 border-t border-terminal-border">
            <button
              onClick={() => setDpia(null)}
              className="btn-secondary text-sm py-2"
            >
              New DPIA
            </button>
            <Link href="/govi" className="btn-primary text-sm py-2">
              Full AI-assisted DPIA <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function HowItWorks() {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [dpiaOpen, setDpiaOpen] = useState(false);

  return (
    <>
      {intakeOpen && <IntakePopup onClose={() => setIntakeOpen(false)} />}
      {dpiaOpen && <DPIAPopup onClose={() => setDpiaOpen(false)} />}

      <section className="section">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 border border-terminal-border rounded-full bg-terminal-dark/50">
              <span className="w-1.5 h-1.5 bg-terminal-green rounded-full" />
              <span className="font-mono text-xs text-terminal-muted uppercase tracking-wider">
                How it works
              </span>
            </span>
            <h2 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-4">
              From use case to compliant artifact in three steps
            </h2>
            <p className="text-base md:text-lg text-terminal-muted font-sans max-w-2xl mx-auto leading-relaxed">
              Govi is an AI governance co-pilot for small and mid-sized teams.
              Paste a use case, get a grounded risk assessment, and walk away with
              drafts you can hand to legal.
            </p>
          </div>

          {/* Step cards */}
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 01 — Intake form popup */}
            <li className="relative rounded-xl border border-terminal-border bg-terminal-gray p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-terminal-green/10 text-terminal-green">
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-terminal-muted tracking-wider" aria-hidden="true">01</span>
              </div>
              <h3 className="font-mono text-base font-semibold text-terminal-text">
                Launch the AI intake form
              </h3>
              <p className="text-sm font-sans text-terminal-muted leading-relaxed">
                Describe your AI system in plain English — no jargon required. Open
                the quick intake popup for an instant assessment right here, or scroll
                down to chat with Govi directly.
              </p>
              <button
                onClick={() => setIntakeOpen(true)}
                className="mt-auto btn-primary text-sm py-2 self-start"
              >
                <MessageSquare className="w-4 h-4" />
                Try Intake Form
              </button>
            </li>

            {/* Card 02 — Go to Govi */}
            <li className="relative rounded-xl border border-terminal-border bg-terminal-gray p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-terminal-green/10 text-terminal-green">
                  <ScanSearch className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-terminal-muted tracking-wider" aria-hidden="true">02</span>
              </div>
              <h3 className="font-mono text-base font-semibold text-terminal-text">
                Get instant analysis
              </h3>
              <p className="text-sm font-sans text-terminal-muted leading-relaxed">
                Govi maps your use case to EU AI Act, GDPR, and NIST frameworks,
                surfaces risks, and flags policy gaps — in seconds.
              </p>
              <Link
                href="/govi"
                className="mt-auto btn-primary text-sm py-2 self-start"
              >
                <ScanSearch className="w-4 h-4" />
                Open Govi
              </Link>
            </li>

            {/* Card 03 — Generate free DPIA */}
            <li className="relative rounded-xl border border-terminal-border bg-terminal-gray p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-terminal-green/10 text-terminal-green">
                  <FileSignature className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-terminal-muted tracking-wider" aria-hidden="true">03</span>
              </div>
              <h3 className="font-mono text-base font-semibold text-terminal-text">
                Generate governance artifacts
              </h3>
              <p className="text-sm font-sans text-terminal-muted leading-relaxed">
                Turn your use case into a ready-to-use DPIA, threat model, model card,
                or implementation playbook — download free, no account needed.
              </p>
              <button
                onClick={() => setDpiaOpen(true)}
                className="mt-auto btn-primary text-sm py-2 self-start"
              >
                <FileSignature className="w-4 h-4" />
                Generate Free DPIA
              </button>
            </li>
          </ol>

          {/* Try it hint */}
          <p className="mt-10 text-center text-sm font-sans text-terminal-muted">
            Try it below — no sign-up needed for your first analysis.
          </p>
        </div>
      </section>
    </>
  );
}
