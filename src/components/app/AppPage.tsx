import type { ReactNode } from "react";

/**
 * Standard container for authenticated app pages. Provides the app-density
 * rhythm (tight padding, not marketing-scale) and a centered max-width column
 * with consistent vertical spacing between page sections.
 *
 * Replaces the ad-hoc `<div className="section min-h-screen"><div className="max-w-7xl mx-auto">`
 * pattern that reused marketing spacing (py-20/28) on data pages.
 *
 * `width` overrides the column width for reading-oriented pages (e.g.
 * "max-w-3xl" for the board report). `outerClassName` reaches the padded
 * wrapper for cases like print styles ("print:p-0").
 */
export function AppPage({
  children,
  className = "",
  width = "max-w-7xl",
  outerClassName = "",
}: {
  children: ReactNode;
  className?: string;
  width?: string;
  outerClassName?: string;
}) {
  return (
    <div className={`min-h-screen px-4 py-8 sm:px-6 md:px-8 md:py-10 ${outerClassName}`}>
      <div className={`mx-auto flex ${width} flex-col gap-6 ${className}`}>{children}</div>
    </div>
  );
}
