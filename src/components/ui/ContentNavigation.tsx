"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
}

interface ContentNavigationProps {
  previous?: NavItem | null;
  next?: NavItem | null;
}

export function ContentNavigation({ previous, next }: ContentNavigationProps) {
  if (!previous && !next) return null;

  return (
    <nav className="flex flex-col sm:flex-row items-stretch gap-4 mt-12 pt-8 border-t border-terminal-border">
      {/* Previous */}
      <div className="flex-1">
        {previous && (
          <Link
            href={previous.href}
            className="group flex items-center gap-3 p-4 border border-terminal-border rounded-md hover:border-terminal-green/50 transition-colors h-full"
          >
            <ArrowLeft className="w-5 h-5 text-terminal-muted group-hover:text-terminal-green transition-colors flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">
                Previous
              </div>
              <div className="font-mono text-sm text-terminal-text group-hover:text-terminal-green transition-colors truncate">
                {previous.title}
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Next */}
      <div className="flex-1">
        {next && (
          <Link
            href={next.href}
            className="group flex items-center justify-end gap-3 p-4 border border-terminal-border rounded-md hover:border-terminal-green/50 transition-colors h-full text-right"
          >
            <div className="min-w-0">
              <div className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">
                Next
              </div>
              <div className="font-mono text-sm text-terminal-text group-hover:text-terminal-green transition-colors truncate">
                {next.title}
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-terminal-muted group-hover:text-terminal-green transition-colors flex-shrink-0" />
          </Link>
        )}
      </div>
    </nav>
  );
}
