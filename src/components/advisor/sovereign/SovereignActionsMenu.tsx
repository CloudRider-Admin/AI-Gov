'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  MessageSquarePlus,
  History,
  FileText,
  BookOpen,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { ConversationSummary } from '@/types/advisor';

interface SovereignActionsMenuProps {
  isAuthenticated: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  exportDisabled: boolean;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onExport: () => void;
}

/**
 * The single "+" affordance that gathers every secondary Govi action out of the
 * chat header and into one tidy popover anchored to the composer. Keeps the
 * conversation surface distraction-free: new session, session history, export,
 * the GovSecure Library and interface settings all live here.
 */
export function SovereignActionsMenu({
  isAuthenticated,
  conversations,
  activeConversationId,
  exportDisabled,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onExport,
}: SovereignActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-10 w-10 place-items-center rounded-md transition-colors duration-300 ${
          open
            ? 'bg-terminal-green/10 text-terminal-green'
            : 'text-terminal-muted hover:bg-terminal-gray/40 hover:text-terminal-text'
        }`}
      >
        <Plus className={`h-5 w-5 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-3 w-72 overflow-hidden rounded-xl border border-terminal-border bg-terminal-dark shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          {/* Primary actions */}
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                onNewConversation();
                close();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-terminal-green transition-colors duration-300 hover:bg-terminal-green/10"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New session
            </button>
            <button
              type="button"
              disabled={exportDisabled}
              onClick={() => {
                onExport();
                close();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-terminal-text transition-colors duration-300 hover:bg-terminal-gray/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileText className="h-4 w-4 text-terminal-muted" />
              Export session log
            </button>
            <Link
              href="/govi/library"
              onClick={close}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-terminal-text transition-colors duration-300 hover:bg-terminal-gray/40"
            >
              <BookOpen className="h-4 w-4 text-terminal-muted" />
              GovSecure Library
            </Link>
            <Link
              href="/settings"
              onClick={close}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-terminal-text transition-colors duration-300 hover:bg-terminal-gray/40"
            >
              <SlidersHorizontal className="h-4 w-4 text-terminal-muted" />
              Change interface
            </Link>
          </div>

          {/* Session history */}
          {isAuthenticated && conversations.length > 0 && (
            <div className="border-t border-terminal-border p-1.5">
              <p className="flex items-center gap-1.5 px-3 pb-1 pt-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
                <History className="h-3 w-3" />
                Recent sessions
              </p>
              <div className="max-h-56 overflow-y-auto">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-1 rounded-md px-1 ${
                      activeConversationId === c.id ? 'bg-terminal-gray/40' : 'hover:bg-terminal-gray/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectConversation(c.id);
                        close();
                      }}
                      className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm text-terminal-text"
                    >
                      {c.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteConversation(c.id)}
                      aria-label="Delete session"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-terminal-muted opacity-0 transition hover:bg-terminal-red/10 hover:text-terminal-red group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
