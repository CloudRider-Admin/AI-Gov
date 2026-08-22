import type { ReactNode } from "react";

/**
 * Consistent page header for authenticated app pages: an optional eyebrow, a
 * right-sized title (app scale, not marketing 5xl), an optional description,
 * and a right-aligned actions slot.
 *
 * `title`/`eyebrow`/`description` accept ReactNode so pages with inline accents
 * (e.g. a green name span, a dynamic status tone) can still use it.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow != null && (
          <div className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-terminal-green">
            {eyebrow}
          </div>
        )}
        <h1 className="font-mono text-2xl font-bold tracking-tight text-terminal-text">
          {title}
        </h1>
        {description != null && (
          <p className="mt-1.5 max-w-2xl font-sans text-sm leading-relaxed text-terminal-muted">
            {description}
          </p>
        )}
      </div>
      {actions != null && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </header>
  );
}
