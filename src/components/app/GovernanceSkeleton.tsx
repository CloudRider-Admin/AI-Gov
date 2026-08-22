import { AppPage } from "./AppPage";

/**
 * Loading state for the authenticated governance pages.
 *
 * These pages are async server components that run anywhere from four to twenty
 * queries, so without a `loading.tsx` the browser sits on the previous route
 * with no feedback until every one of them returns. The skeleton mirrors the
 * real page's rhythm — header, optional stat row, panel — so the layout does not
 * jump when the content arrives.
 */
export function GovernanceSkeleton({
  stats = 0,
  rows = 6,
  width = "max-w-7xl",
}: {
  /** How many KPI tiles the real page shows above the panel. */
  stats?: number;
  rows?: number;
  width?: string;
}) {
  return (
    <AppPage width={width}>
      {/* Page header */}
      <div className="flex flex-col gap-3" aria-hidden="true">
        <div className="h-3 w-32 animate-pulse rounded bg-terminal-gray/50" />
        <div className="h-8 w-64 animate-pulse rounded bg-terminal-gray/50" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-terminal-gray/40" />
      </div>

      {stats > 0 && (
        <div
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          aria-hidden="true"
        >
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="h-3 w-20 animate-pulse rounded bg-terminal-gray/50" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-terminal-gray/50" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-terminal-gray/40" />
            </div>
          ))}
        </div>
      )}

      <div className="glass rounded-xl" aria-hidden="true">
        <div className="border-b border-terminal-border/50 px-4 py-3">
          <div className="h-4 w-36 animate-pulse rounded bg-terminal-gray/50" />
        </div>
        <div className="divide-y divide-terminal-border/50">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-terminal-gray/50" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-28 animate-pulse rounded bg-terminal-gray/50" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-terminal-gray/40" />
              </div>
              <div className="h-3 w-24 shrink-0 animate-pulse rounded bg-terminal-gray/40" />
            </div>
          ))}
        </div>
      </div>

      {/* The visual skeleton is decorative; this is what a screen reader hears. */}
      <p className="sr-only" role="status">
        Loading…
      </p>
    </AppPage>
  );
}
