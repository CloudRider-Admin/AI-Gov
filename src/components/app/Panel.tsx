import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Raised surface for dashboard/app regions: bordered card with an optional
 * header row (mono title + right-aligned action). Content sits flush so
 * tables can run edge-to-edge; pass `padded` for prose/feed content.
 */
export function Panel({
  title,
  action,
  children,
  padded = false,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={`glass overflow-hidden rounded-xl ${className}`}>
      {title != null && (
        <header className="flex items-center justify-between gap-4 border-b border-terminal-border px-4 py-3">
          <h2 className="font-mono text-xs font-bold tracking-wide text-terminal-text">{title}</h2>
          {action != null && <div className="flex-none font-mono text-xs">{action}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

/** Green mono "View all →" style link for a Panel header's action slot. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-terminal-green hover:underline">
      {children} →
    </Link>
  );
}
