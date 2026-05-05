'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { advisorContent } from '@/data/content';

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

interface AdvisorInputProps {
  query: string;
  isLoading: boolean;
  hasContent: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  placeholder?: string;
}

export function AdvisorInput({
  query,
  isLoading,
  hasContent,
  onChange,
  onSubmit,
  onReset,
  placeholder,
}: AdvisorInputProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when placeholder changes (follow-up question clicked)
  useEffect(() => {
    if (placeholder && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [placeholder]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleChange = (value: string) => {
    if (value.length <= MAX_LENGTH) {
      onChange(value);
      if (validationError) setValidationError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < MIN_LENGTH) {
      setValidationError(`Please provide at least ${MIN_LENGTH} characters to analyze.`);
      return;
    }
    setValidationError(null);
    onSubmit(e);
  };

  const remaining = MAX_LENGTH - query.length;
  const isNearLimit = remaining < 200;
  const isOverLimit = remaining < 0;
  const hasFollowUpPrompt = !!placeholder && placeholder !== advisorContent.placeholder;

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      {/* Follow-up prompt banner */}
      {hasFollowUpPrompt && !query.trim() && (
        <div className="mb-3 px-3 py-2 rounded-md border border-terminal-cyan/30 bg-terminal-cyan/5">
          <p className="text-xs font-sans text-terminal-cyan leading-relaxed">
            <span className="font-mono font-semibold">Govi asked:</span> {placeholder}
          </p>
          <p className="text-xs font-mono text-terminal-muted mt-1">
            Type your answer below ↓
          </p>
        </div>
      )}
      <div className="flex items-start gap-2 mb-4">
        <span className="text-terminal-green font-mono">{'>'}</span>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasFollowUpPrompt ? `Answer: ${placeholder}` : advisorContent.placeholder}
          className={`flex-grow bg-transparent border-none outline-none text-terminal-text font-mono text-sm resize-none min-h-[80px] placeholder:text-terminal-muted ${
            hasFollowUpPrompt && !query.trim() ? 'ring-1 ring-terminal-cyan/30 rounded-md px-2 py-1' : ''
          }`}
          disabled={isLoading}
        />
      </div>

      {validationError && (
        <p className="text-xs text-terminal-red font-sans mb-2 ml-4">{validationError}</p>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-xs font-mono ${isOverLimit ? 'text-terminal-red' : isNearLimit ? 'text-terminal-amber' : 'text-terminal-muted'}`}>
          {query.length > 0
            ? isNearLimit
              ? `${remaining} characters remaining`
              : `${query.length} chars · Ctrl+Enter to submit`
            : 'Describe your AI use case...'}
        </span>
        <div className="flex gap-3">
          {hasContent && (
            <button
              type="button"
              onClick={onReset}
              className="btn-secondary text-sm py-2"
              disabled={isLoading}
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !query.trim() || isOverLimit}
            className="btn-primary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {advisorContent.cta}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
