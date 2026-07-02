'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, ArrowUp, Loader2, ShieldCheck } from 'lucide-react';

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

interface SovereignInputProps {
  query: string;
  isLoading: boolean;
  followUpPrompt?: string | null;
  /** Optional actions affordance (the "+" menu) rendered beside the attach button. */
  actionsSlot?: React.ReactNode;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function SovereignInput({
  query,
  isLoading,
  followUpPrompt,
  actionsSlot,
  onChange,
  onSubmit,
}: SovereignInputProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (followUpPrompt && textareaRef.current) textareaRef.current.focus();
  }, [followUpPrompt]);

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
    if (query.trim().length < MIN_LENGTH) {
      setValidationError(`Please provide at least ${MIN_LENGTH} characters to analyze.`);
      return;
    }
    setValidationError(null);
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit}>
      {followUpPrompt && !query.trim() && (
        <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2">
          <p className="text-[13px] leading-relaxed text-emerald-800">
            <span className="font-semibold">Govi asked:</span> {followUpPrompt}
          </p>
        </div>
      )}
      {validationError && (
        <p className="mb-2 px-1 text-xs text-red-500">{validationError}</p>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] transition-shadow focus-within:shadow-[0_4px_24px_rgba(15,23,42,0.1)] focus-within:border-slate-300">
        {actionsSlot}
        <button
          type="button"
          aria-label="Attach document"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Describe your AI use case, or ask a governance question…"
          disabled={isLoading}
          className="max-h-40 min-h-[40px] flex-grow resize-none self-center bg-transparent px-1 py-2 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Grounded in the GovSecure Library
        </span>
        <span className="hidden text-[11px] font-mono text-slate-400 sm:block">
          Press ⌘ + Enter to send
        </span>
      </div>
    </form>
  );
}
