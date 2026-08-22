const RISK_PILL: Record<string, string> = {
  high: "text-terminal-red bg-terminal-red/10 border-terminal-red/40",
  moderate: "text-terminal-amber bg-terminal-amber/10 border-terminal-amber/40",
  low: "text-terminal-green bg-terminal-green/10 border-terminal-green/40",
};

const RISK_LABELS: Record<string, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
};

/** Severity pill for the NIST impact tiers (High / Moderate / Low). */
export function RiskPill({ risk }: { risk: string }) {
  const style = RISK_PILL[risk] ?? RISK_PILL.moderate;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {RISK_LABELS[risk] ?? risk}
    </span>
  );
}

const SEVERITY_PILL: Record<string, string> = {
  critical: "text-terminal-red bg-terminal-red/15 border-terminal-red/50",
  high: "text-terminal-red bg-terminal-red/10 border-terminal-red/40",
  medium: "text-terminal-amber bg-terminal-amber/10 border-terminal-amber/40",
  low: "text-terminal-green bg-terminal-green/10 border-terminal-green/40",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Legacy rows predating the `low|medium|high|critical` scale used "moderate". */
const SEVERITY_ALIASES: Record<string, string> = { moderate: "medium" };

function severityKey(level: string | null): string {
  const raw = (level ?? "").toLowerCase();
  return SEVERITY_ALIASES[raw] ?? raw;
}

/**
 * Severity pill for the four-tier conversation risk scale
 * (`low|medium|high|critical`, as emitted by the multi-agent pipeline).
 *
 * Distinct from {@link RiskPill}, which renders the three NIST impact tiers
 * an AI system carries. Both share the pill shape and color language so a
 * page showing them side by side reads as one scale; `null` (unscored)
 * renders as a muted "Unrated" rather than being silently downgraded to Low.
 */
export function SeverityPill({ level }: { level: string | null }) {
  const key = severityKey(level);
  const style = SEVERITY_PILL[key];
  if (!style) {
    return (
      <span className="inline-flex items-center rounded-full border border-terminal-border bg-terminal-gray/30 px-2.5 py-0.5 font-mono text-xs text-terminal-muted">
        Unrated
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {SEVERITY_LABELS[key]}
    </span>
  );
}

/** Plain-text severity label — for CSV exports and aria labels. */
export function severityLabel(level: string | null): string {
  return SEVERITY_LABELS[severityKey(level)] ?? "Unrated";
}

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  piloting: "Piloting",
  production: "Production",
  retired: "Retired",
};

/** Neutral pill for an AI system's lifecycle stage. */
export function StagePill({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-terminal-border bg-terminal-gray/30 px-2.5 py-0.5 font-mono text-xs text-terminal-muted">
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

const APPROVAL_PILL: Record<string, string> = {
  approved: "text-terminal-green bg-terminal-green/10 border-terminal-green/40",
  pending: "text-terminal-amber bg-terminal-amber/10 border-terminal-amber/40",
  rejected: "text-terminal-red bg-terminal-red/10 border-terminal-red/40",
};

const APPROVAL_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
};

/**
 * Gate 3 approval pill. `status` is null when approval is not required
 * (low-risk entries) — rendered as a muted "n/a".
 */
export function ApprovalPill({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-terminal-border bg-terminal-gray/30 px-2.5 py-0.5 font-mono text-xs text-terminal-muted">
        n/a
      </span>
    );
  }
  const style = APPROVAL_PILL[status] ?? APPROVAL_PILL.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {APPROVAL_LABELS[status] ?? status}
    </span>
  );
}
