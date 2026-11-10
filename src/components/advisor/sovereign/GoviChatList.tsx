'use client';

import { useMemo, useState } from 'react';
import { Search, SquarePen, Trash2, PanelLeftClose, Check, X } from 'lucide-react';
import type { ConversationSummary } from '@/types/advisor';

interface GoviChatListProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onHide: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function groupLabel(updatedAt: string, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(updatedAt).getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfToday - DAY_MS) return 'Yesterday';
  if (t >= startOfToday - 7 * DAY_MS) return 'Previous 7 days';
  if (t >= startOfToday - 30 * DAY_MS) return 'Previous 30 days';
  return 'Older';
}

/**
 * Govi's own conversation column: new chat, search, and the chat history
 * grouped by recency. Deleting asks for an inline confirmation first.
 */
export function GoviChatList({
  conversations,
  activeConversationId,
  onNew,
  onSelect,
  onDelete,
  onHide,
}: GoviChatListProps) {
  const [filter, setFilter] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = new Date();
    const needle = filter.trim().toLowerCase();
    const list = needle
      ? conversations.filter((c) => c.title.toLowerCase().includes(needle))
      : conversations;
    const out: { label: string; items: ConversationSummary[] }[] = [];
    for (const c of list) {
      const label = groupLabel(c.updatedAt, now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [conversations, filter]);

  return (
    <aside
      aria-label="Govi chats"
      className="flex h-full w-64 flex-none flex-col border-r border-terminal-border bg-terminal-black"
    >
      <div className="flex h-12 flex-none items-center justify-between pl-4 pr-2">
        <h2 className="text-sm font-semibold text-terminal-text">Chats</h2>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onNew}
            aria-label="New chat"
            title="New chat"
            className="grid h-8 w-8 place-items-center rounded-lg text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text"
          >
            <SquarePen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide chats"
            title="Hide chats"
            className="grid h-8 w-8 place-items-center rounded-lg text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-none px-3 pb-2">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-terminal-border bg-terminal-dark px-2.5 text-sm text-terminal-muted focus-within:border-terminal-text/30">
          <Search className="h-4 w-4 flex-none" aria-hidden="true" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="min-w-0 flex-1 bg-transparent text-terminal-text outline-none placeholder:text-terminal-muted"
          />
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {conversations.length === 0 ? (
          <p className="px-2.5 py-6 text-sm leading-relaxed text-terminal-muted">
            Your conversations with Govi will appear here.
          </p>
        ) : groups.length === 0 ? (
          <p className="px-2.5 py-6 text-sm text-terminal-muted">No chats match “{filter}”.</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mt-3 first:mt-1">
              <p className="mb-1 px-2.5 text-xs font-medium text-terminal-muted">{g.label}</p>
              <ul className="space-y-px">
                {g.items.map((c) => {
                  const active = c.id === activeConversationId;
                  const confirming = confirmingId === c.id;
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex h-9 w-full items-center rounded-lg pl-2.5 pr-9 text-left text-sm transition-colors ${
                          active
                            ? 'bg-terminal-text/[0.08] font-medium text-terminal-text'
                            : 'text-terminal-text/85 hover:bg-terminal-text/[0.05]'
                        }`}
                      >
                        <span className="truncate">{c.title || 'Untitled chat'}</span>
                      </button>
                      {confirming ? (
                        <span className="absolute inset-y-0 right-1 flex items-center gap-0.5 rounded-lg bg-terminal-dark pl-1">
                          <span className="pr-1 text-xs text-terminal-muted">Delete?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingId(null);
                              onDelete(c.id);
                            }}
                            aria-label={`Confirm delete ${c.title}`}
                            className="grid h-7 w-7 place-items-center rounded-md text-terminal-red hover:bg-terminal-red/10"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            aria-label="Cancel delete"
                            className="grid h-7 w-7 place-items-center rounded-md text-terminal-muted hover:bg-terminal-gray"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(c.id)}
                          aria-label={`Delete ${c.title}`}
                          className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-terminal-muted opacity-0 transition-opacity hover:bg-terminal-gray hover:text-terminal-text focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}
