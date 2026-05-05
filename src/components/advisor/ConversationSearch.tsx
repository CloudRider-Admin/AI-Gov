'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, MessageSquare, Clock } from 'lucide-react';

interface SearchResult {
  conversationId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  snippet?: string;
  rank: number;
}

interface ConversationSearchProps {
  onSelect: (conversationId: string) => void;
}

export function ConversationSearch({ onSelect }: ConversationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }, [search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={query}
          onChange={(e) => {
            handleInputChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.trim() && setIsOpen(true)}
          className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setTotal(0);
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-md"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border bg-popover shadow-lg max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No conversations found</div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                {total} result{total !== 1 ? 's' : ''} found
              </div>
              {results.map((r) => (
                <button
                  key={r.conversationId}
                  onClick={() => {
                    onSelect(r.conversationId);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b last:border-0 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{r.title}</span>
                  </div>
                  {r.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2 ml-5.5 pl-0.5">
                      {r.snippet.length > 150 ? r.snippet.slice(0, 150) + '...' : r.snippet}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 ml-5.5 pl-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(r.updatedAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.messageCount} message{r.messageCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}