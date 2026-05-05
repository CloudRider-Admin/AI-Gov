'use client';

import { useState } from 'react';
import { MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ConversationSummary } from '@/types/advisor';

interface ConversationHistoryProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ConversationHistory({
  conversations,
  activeId,
  isOpen,
  onToggle,
  onSelect,
  onNew,
  onDelete,
}: ConversationHistoryProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <div
      className={`relative flex-shrink-0 transition-all duration-200 ${
        isOpen ? 'w-64' : 'w-10'
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-4 z-10 w-6 h-6 bg-terminal-gray border border-terminal-border rounded-full flex items-center justify-center text-terminal-muted hover:text-terminal-green transition-colors"
        title={isOpen ? 'Collapse history' : 'Expand history'}
      >
        {isOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="terminal-window h-full flex flex-col gap-2 mr-4">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500" />
            <div className="terminal-dot bg-yellow-500" />
            <div className="terminal-dot bg-green-500" />
            <span className="ml-3 text-xs text-terminal-muted font-mono">history</span>
          </div>

          <div className="p-3 flex flex-col gap-2 overflow-y-auto flex-1">
            {/* New conversation button */}
            <button
              onClick={onNew}
              className="w-full flex items-center gap-2 px-3 py-2 mt-3 rounded-md border border-terminal-green/40 text-terminal-green font-mono text-xs hover:bg-terminal-green/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
              New conversation
            </button>

            {conversations.length === 0 && (
              <p className="text-terminal-muted font-mono text-xs text-center py-4">
                No history yet
              </p>
            )}

            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative rounded-md border cursor-pointer transition-colors ${
                  activeId === conv.id
                    ? 'border-terminal-green bg-terminal-green/10'
                    : 'border-terminal-border hover:border-terminal-green/50 hover:bg-terminal-gray/50'
                }`}
              >
                {pendingDeleteId === conv.id ? (
                  /* ── Delete confirmation view ── */
                  <div className="p-2.5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs font-sans text-terminal-red leading-tight">
                      Delete this conversation?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { onDelete(conv.id); setPendingDeleteId(null); }}
                        className="flex-1 text-xs font-mono px-2 py-1.5 bg-terminal-red/20 text-terminal-red rounded-md border border-terminal-red/30 hover:bg-terminal-red/30 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="flex-1 text-xs font-mono px-2 py-1.5 text-terminal-muted rounded-md border border-terminal-border hover:text-terminal-text hover:border-terminal-green/50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal conversation entry ── */
                  <div className="p-2" onClick={() => onSelect(conv.id)}>
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-terminal-muted" />
                      <div className="flex-1 min-w-0">
                        <p className="text-terminal-text font-mono text-xs truncate leading-tight pr-5">
                          {conv.title}
                        </p>
                        <p className="text-terminal-muted font-mono text-xs mt-0.5">
                          {timeAgo(conv.updatedAt)} · {conv.messageCount} msg
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(conv.id);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-md text-terminal-muted hover:text-terminal-red hover:bg-terminal-red/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}