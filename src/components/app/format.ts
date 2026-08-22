/**
 * Review-date cell copy: "Overdue 4d" when past due, "May 12" otherwise,
 * "—" when no review is scheduled.
 */
export function formatReview(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "—", overdue: false };
  const due = new Date(iso);
  const diff = Date.now() - due.getTime();
  if (diff > 0) {
    return { text: `Overdue ${Math.max(1, Math.floor(diff / 86_400_000))}d`, overdue: true };
  }
  return {
    text: due.toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
    overdue: false,
  };
}

/**
 * Compact relative time for feeds and table cells: "just now", "12m ago",
 * "3h ago", "4d ago". One implementation for the whole app — the user
 * dashboard and the admin pages previously each carried their own, so the
 * same timestamp rendered as "2 hours ago" in one place and "2h ago" in
 * another.
 */
export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Abbreviated counts for stat tiles: 1.2K, 15K, 3.4M. */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Delta chip copy: "+4.2%", "-1.0%", "steady" at exactly zero. */
export function formatDelta(pct: number | null | undefined): string {
  if (pct == null) return "—";
  if (pct === 0) return "steady";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/**
 * Tone for a delta chip. `higherIsBetter: false` flips the polarity for
 * metrics where growth is bad (error rate, pending queue).
 */
export function deltaTone(
  pct: number | null | undefined,
  higherIsBetter = true,
): "green" | "amber" | "muted" {
  if (pct == null || pct === 0) return "muted";
  const good = higherIsBetter ? pct > 0 : pct < 0;
  return good ? "green" : "amber";
}
