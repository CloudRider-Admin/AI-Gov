"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, BookOpen, FileText, FolderOpen, FileCode, ArrowRight } from "lucide-react";
import { searchAll, type SearchResult, type SearchResultType } from "@/lib/search";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons: Record<SearchResultType, typeof BookOpen> = {
  playbook: BookOpen,
  topic: FileText,
  category: FolderOpen,
  template: FileCode,
};

const typeLabels: Record<SearchResultType, string> = {
  playbook: "Playbook",
  topic: "Topic",
  category: "Category",
  template: "Template",
};

const levelStyles: Record<string, string> = {
  beginner: "text-terminal-green",
  intermediate: "text-terminal-cyan",
  leadership: "text-terminal-amber",
};

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Search on query change
  useEffect(() => {
    const searchResults = searchAll(query);
    setResults(searchResults.slice(0, 10)); // Limit to 10 results
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            router.push(results[selectedIndex].href);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, router, onClose]
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4">
        <div className="bg-terminal-dark border border-terminal-border rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-terminal-border">
            <Search className="w-5 h-5 text-terminal-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search playbooks, topics, templates..."
              className="flex-grow bg-transparent text-terminal-text font-mono text-sm outline-none placeholder:text-terminal-muted"
            />
            <button
              onClick={onClose}
              className="p-1 text-terminal-muted hover:text-terminal-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-terminal-muted text-sm font-mono">
                  Type at least 2 characters to search...
                </p>
                <p className="text-terminal-muted text-xs font-mono mt-2">
                  Press <kbd className="px-1.5 py-0.5 bg-terminal-gray rounded-md text-terminal-text">Esc</kbd> to close
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-terminal-muted text-sm font-mono">
                  No results found for &quot;{query}&quot;
                </p>
              </div>
            ) : (
              <ul className="py-2">
                {results.map((result, index) => {
                  const Icon = typeIcons[result.type];
                  const isSelected = index === selectedIndex;

                  return (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        onClick={() => {
                          router.push(result.href);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full px-4 py-3 flex items-start gap-3 text-left transition-colors ${
                          isSelected
                            ? "bg-terminal-green/10"
                            : "hover:bg-terminal-gray/50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-md border flex-shrink-0 ${
                            isSelected
                              ? "border-terminal-green/50 bg-terminal-green/10"
                              : "border-terminal-border bg-terminal-gray"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 ${
                              isSelected ? "text-terminal-green" : "text-terminal-muted"
                            }`}
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-sm truncate ${
                                isSelected ? "text-terminal-green" : "text-terminal-text"
                              }`}
                            >
                              {result.title}
                            </span>
                            {result.level && (
                              <span
                                className={`text-xs font-mono ${levelStyles[result.level]}`}
                              >
                                {result.level}
                              </span>
                            )}
                          </div>
                          <p className="text-terminal-muted text-xs font-sans truncate mt-0.5">
                            {result.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-terminal-muted">
                              {typeLabels[result.type]}
                            </span>
                            {result.category && (
                              <>
                                <span className="text-terminal-muted" aria-hidden="true">•</span>
                                <span className="text-xs font-mono text-terminal-muted">
                                  {result.category}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-terminal-green flex-shrink-0 mt-2" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-terminal-border bg-terminal-gray/30 flex items-center justify-between text-xs font-mono text-terminal-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-terminal-gray rounded-md text-terminal-text">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-terminal-gray rounded-md text-terminal-text">↓</kbd>
                <span className="ml-1">Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-terminal-gray rounded-md text-terminal-text">↵</kbd>
                <span className="ml-1">Open</span>
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-terminal-gray rounded-md text-terminal-text">Esc</kbd>
              <span className="ml-1">Close</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
