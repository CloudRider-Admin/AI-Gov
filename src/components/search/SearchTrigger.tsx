"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { SearchModal } from "./SearchModal";

interface SearchTriggerProps {
  className?: string;
  showShortcut?: boolean;
  /**
   * Whether this instance owns the global Ctrl/⌘+K shortcut. Only one mounted
   * trigger should listen, or the shortcut opens stacked modals.
   */
  listenShortcut?: boolean;
  /** "sidebar" renders a full-width nav row (icon-only when `collapsed`). */
  variant?: "default" | "sidebar";
  collapsed?: boolean;
}

export function SearchTrigger({
  className = "",
  showShortcut = true,
  listenShortcut = true,
  variant = "default",
  collapsed = false,
}: SearchTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Global keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    if (!listenShortcut) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [listenShortcut]);

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Search"
          className={`group flex h-9 w-full items-center gap-3 rounded-lg text-sm text-terminal-muted transition-colors hover:bg-terminal-text/[0.06] hover:text-terminal-text ${
            collapsed ? "justify-center px-0" : "px-2.5"
          } ${className}`}
        >
          <Search className="h-4 w-4 flex-none" aria-hidden="true" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              {showShortcut && (
                <kbd className="rounded border border-terminal-border px-1.5 py-px font-sans text-[11px] text-terminal-muted">
                  Ctrl K
                </kbd>
              )}
            </>
          )}
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 bg-terminal-gray/50 border border-terminal-border rounded-md hover:border-terminal-green/50 transition-colors ${className}`}
        >
          <Search className="w-4 h-4 text-terminal-muted" />
          <span className="text-sm font-mono text-terminal-muted hidden sm:inline">
            Search...
          </span>
          {showShortcut && (
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-terminal-dark rounded-md text-xs font-mono text-terminal-muted">
              <span>Ctrl</span>
              <span>or</span>
              <span>⌘+</span>K
            </kbd>
          )}
        </button>
      )}

      <SearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
