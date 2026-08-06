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
