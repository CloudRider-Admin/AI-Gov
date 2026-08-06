import type { ReactNode } from "react";

export type KpiTone = "green" | "red" | "cyan" | "amber" | "muted";

const DOT: Record<KpiTone, string> = {
  green: "bg-terminal-green",
  red: "bg-terminal-red",
  cyan: "bg-terminal-cyan",
  amber: "bg-terminal-amber",
  muted: "bg-terminal-muted",
};

const TEXT: Record<KpiTone, string> = {
  green: "text-terminal-green",
  red: "text-terminal-red",
  cyan: "text-terminal-cyan",
  amber: "text-terminal-amber",
  muted: "text-terminal-muted",
};

const CHIP: Record<KpiTone, string> = {
  green: "text-terminal-green bg-terminal-green/10",
  red: "text-terminal-red bg-terminal-red/10",
  cyan: "text-terminal-cyan bg-terminal-cyan/10",
  amber: "text-terminal-amber bg-terminal-amber/10",
  muted: "text-terminal-muted bg-terminal-gray/30",
};

/**
 * Stat tile for app pages: colored-dot mono label, large tabular value, an
 * optional delta chip, and an optional sparkline or progress bar underneath.
 */
export function KpiCard({
  tone,
  label,
  value,
  delta,
  deltaTone = tone,
  trend,
  barPercent,
}: {
  tone: KpiTone;
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: KpiTone;
  trend?: number[];
  barPercent?: number;
}) {
  return (
    <div className="glass rounded-xl p-4 transition-all duration-300 hover:-translate-y-px hover:border-terminal-border">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-terminal-muted">
        <span className={`h-1.5 w-1.5 flex-none rounded-full ${DOT[tone]}`} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="font-mono text-3xl font-bold leading-none tracking-tight tabular-nums text-terminal-text">
          {value}
        </span>
        {delta != null && (
          <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold ${CHIP[deltaTone]}`}>
            {delta}
          </span>
        )}
      </div>
      {trend != null && <Sparkline data={trend} className={`mt-2 ${TEXT[tone]}`} />}
      {barPercent != null && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-terminal-gray/30">
          <div
            className={`h-full rounded-full ${DOT[tone]}`}
            style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Filled line sparkline; inherits its color from the surrounding text color. */
export function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  if (data.length < 2) {
    return <div className={`h-6 rounded-md bg-terminal-gray/30 ${className}`} aria-hidden="true" />;
  }
  const max = Math.max(1, ...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 120},${24 - (v / max) * 20}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 120 26"
      preserveAspectRatio="none"
      className={`block h-6 w-full ${className}`}
      aria-hidden="true"
    >
      <polygon points={`0,26 ${pts} 120,26`} fill="currentColor" fillOpacity="0.1" />
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
