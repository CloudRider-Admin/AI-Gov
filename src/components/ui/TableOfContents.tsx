"use client";

import { useState, useEffect } from "react";
import { List } from "lucide-react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Parse headings from markdown content
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const matches: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      
      matches.push({ id, text, level });
    }

    setItems(matches);
  }, [content]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -80% 0px" }
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-12 h-12 bg-terminal-green text-terminal-black rounded-full flex items-center justify-center shadow-lg"
      >
        <List className="w-5 h-5" />
      </button>

      {/* Table of contents */}
      <nav
        className={`
          fixed lg:sticky top-20 right-0 lg:right-auto
          w-64 max-h-[calc(100vh-6rem)] overflow-y-auto
          bg-terminal-dark lg:bg-transparent
          border-l lg:border-l-0 border-terminal-border
          p-4 lg:p-0
          transform transition-transform lg:transform-none
          ${isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          z-30
        `}
      >
        <div className="font-mono text-xs text-terminal-green uppercase tracking-wider mb-4 flex items-center gap-2">
          <List className="w-4 h-4" />
          On This Page
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
            >
              <a
                href={`#${item.id}`}
                onClick={() => setIsOpen(false)}
                className={`
                  block text-sm font-sans py-1 transition-colors
                  ${
                    activeId === item.id
                      ? "text-terminal-green"
                      : "text-terminal-muted hover:text-terminal-text"
                  }
                `}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
