"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import Link from "next/link";
import { AppPage } from "./AppPage";

/**
 * Error boundary body for the authenticated governance pages.
 *
 * Scoped per route segment so a failed query on, say, the compliance page keeps
 * the header and navigation intact instead of taking the whole shell down to the
 * root boundary. The copy names the surface that failed, because "something went
 * wrong" tells a compliance user nothing about whether their data is at risk.
 */
export function GovernanceError({
  error,
  reset,
  surface,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** What the user was looking at, e.g. "the AI system register". */
  surface: string;
}) {
  useEffect(() => {
    console.error(`[${surface}]`, error.digest ?? "", error);
  }, [error, surface]);

  return (
    <AppPage width="max-w-2xl">
      <div className="glass rounded-xl p-8 text-center" role="alert">
        <AlertTriangle
          className="mx-auto mb-4 h-10 w-10 text-terminal-amber"
          aria-hidden="true"
        />
        <h1 className="mb-2 font-mono text-lg text-terminal-text">
          Could not load {surface}
        </h1>
        <p className="mx-auto mb-6 max-w-md text-sm text-terminal-muted">
          Nothing was changed — this is a read that did not complete. Try again, and
          if it keeps happening the reference below will let support find the cause.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={reset} className="btn-primary text-xs py-1.5">
            <RotateCw className="h-3.5 w-3.5" /> Try again
          </button>
          <Link href="/dashboard" className="btn-secondary text-xs py-1.5">
            Back to dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="mt-5 font-mono text-[11px] text-terminal-muted">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </AppPage>
  );
}
