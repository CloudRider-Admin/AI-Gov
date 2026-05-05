"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { SearchModal } from "./SearchModal";

interface SearchTriggerProps {
  className?: string;
  showShortcut?: boolean;
}

export function SearchTrigger({ className = "", showShortcut = true }: SearchTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Global keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
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

      <SearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
