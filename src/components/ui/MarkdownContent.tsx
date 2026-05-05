"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-mono font-bold text-terminal-text mt-12 mb-6">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-mono font-bold text-terminal-text mt-10 mb-4">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-mono font-bold text-terminal-text mt-8 mb-3">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-terminal-muted leading-relaxed mb-4">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-terminal-text">{children}</strong>
  ),
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => <ul className="list-disc my-4">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal my-4">{children}</ol>,
  li: ({ children }) => (
    <li className="ml-4 mb-2 text-terminal-muted">{children}</li>
  ),
  pre: ({ children }) => (
    <pre className="bg-terminal-gray border border-terminal-border rounded-md p-4 my-4 overflow-x-auto font-mono text-sm">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) return <code>{children}</code>;
    return (
      <code className="bg-terminal-gray px-2 py-0.5 rounded-md text-terminal-green font-mono text-sm">
        {children}
      </code>
    );
  },
};

/**
 * Simple markdown renderer for local content
 * For Sanity, use PortableText component instead
 */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  return (
    <div className={`prose-terminal ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
