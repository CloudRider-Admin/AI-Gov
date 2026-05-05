'use client';

interface AdvisorStreamingPanelProps {
  query: string;
  text: string;
  stage: string | null;
}

export function AdvisorStreamingPanel({ query, text, stage }: AdvisorStreamingPanelProps) {
  return (
    <div className="border-t border-terminal-border pt-6 animate-slide-up space-y-4">
      {/* Query header */}
      <div className="text-sm text-terminal-muted font-mono border border-terminal-border bg-terminal-gray/30 rounded px-3 py-2">
        <span className="text-terminal-green mr-2">&gt;</span>
        <span className="text-terminal-text">{query}</span>
      </div>

      {/* Stage indicator */}
      {stage && (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${stage === 'reconnecting' ? 'bg-terminal-amber' : 'bg-terminal-green'}`} />
          <span className="text-xs font-mono text-terminal-muted uppercase tracking-wider">
            {stage === 'analyzing'
              ? 'Analyzing with AI governance frameworks...'
              : stage === 'reconnecting'
              ? 'Reconnecting...'
              : stage === 'streaming'
              ? `Streaming response (${text.length.toLocaleString()} chars)`
              : stage}
          </span>
        </div>
      )}

      {/* Streaming text output */}
      {text && (
        <div className="bg-terminal-gray/30 border border-terminal-border rounded p-4 font-mono text-sm text-terminal-text whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
          {text}
          <span className="inline-block w-2 h-4 bg-terminal-green/80 animate-pulse ml-0.5 align-text-bottom" />
        </div>
      )}
    </div>
  );
}