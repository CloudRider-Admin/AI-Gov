'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, ArrowUp, Loader2, ShieldCheck, X, FileText, Check } from 'lucide-react';

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

// Mirror the server limits in /api/documents/upload.
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILES =
  '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

interface AttachState {
  status: 'idle' | 'uploading' | 'done' | 'error';
  fileName?: string;
  message?: string;
}

interface SovereignInputProps {
  query: string;
  isLoading: boolean;
  followUpPrompt?: string | null;
  /** Optional actions affordance (the "+" menu) rendered beside the attach button. */
  actionsSlot?: React.ReactNode;
  /** Document upload is a Pro+ feature; free users get an upgrade hint instead. */
  isPaidUser?: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  /** "hero" is the large centered composer on the empty state. */
  variant?: 'hero' | 'dock';
  placeholder?: string;
}

export function SovereignInput({
  query,
  isLoading,
  followUpPrompt,
  actionsSlot,
  isPaidUser,
  onChange,
  onSubmit,
  variant = 'dock',
  placeholder = 'Describe your AI use case, or ask a governance question…',
}: SovereignInputProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attach, setAttach] = useState<AttachState>({ status: 'idle' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (followUpPrompt && textareaRef.current) textareaRef.current.focus();
  }, [followUpPrompt]);

  // Auto-grow the textarea with its content (capped by max-h).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline (Ctrl/⌘+Enter also sends).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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

  const openFilePicker = () => {
    if (isPaidUser === false) {
      setAttach({ status: 'error', message: 'Upgrade to Pro to attach documents.' });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setAttach({ status: 'error', fileName: file.name, message: 'File too large (max 5MB).' });
      return;
    }

    setAttach({ status: 'uploading', fileName: file.name });
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttach({
          status: 'error',
          fileName: file.name,
          message: data.error ?? 'Upload failed. Please try again.',
        });
        return;
      }
      setAttach({ status: 'done', fileName: file.name });
    } catch {
      setAttach({ status: 'error', fileName: file.name, message: 'Network error. Please try again.' });
    }
  };

  const attachTone =
    attach.status === 'error'
      ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'
      : attach.status === 'done'
        ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
        : 'border-terminal-border bg-terminal-gray/30 text-terminal-muted';

  return (
    <form onSubmit={handleSubmit}>
      {followUpPrompt && !query.trim() && (
        <div className="mb-2 rounded-md border border-terminal-cyan/40 bg-terminal-cyan/10 px-3.5 py-2">
          <p className="text-sm leading-relaxed text-terminal-cyan">
            <span className="font-semibold">Govi asked:</span> {followUpPrompt}
          </p>
        </div>
      )}

      {attach.status !== 'idle' && (
        <div className={`mb-2 flex items-center gap-2 rounded-md border px-3.5 py-2 ${attachTone}`}>
          {attach.status === 'uploading' ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : attach.status === 'done' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 shrink-0" />
          )}
          <p className="flex-1 text-sm leading-snug">
            {attach.status === 'uploading'
              ? `Uploading ${attach.fileName}…`
              : attach.status === 'done'
                ? `${attach.fileName} attached — Govi can reference it in this conversation.`
                : attach.message}
          </p>
          {attach.status !== 'uploading' && (
            <button
              type="button"
              onClick={() => setAttach({ status: 'idle' })}
              aria-label="Dismiss"
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {validationError && (
        <p className="mb-2 px-1 text-xs text-terminal-red">{validationError}</p>
      )}
      <div
        className={`surface rounded-2xl transition-colors duration-200 focus-within:border-terminal-text/25 ${
          variant === 'hero' ? 'shadow-app' : ''
        }`}
      >
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={variant === 'hero' ? 2 : 1}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="Message Govi"
          className={`block w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed text-terminal-text outline-none placeholder:text-terminal-muted ${
            variant === 'hero' ? 'max-h-60 min-h-[64px]' : 'max-h-48 min-h-[28px]'
          }`}
        />
        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          {actionsSlot}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILES}
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            aria-label="Attach document"
            title="Attach a document (PDF, DOCX, TXT, MD)"
            onClick={openFilePicker}
            disabled={attach.status === 'uploading'}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {attach.status === 'uploading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          <span className="ml-1 hidden items-center gap-1.5 text-xs text-terminal-muted sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-terminal-green" />
            Grounded in the GovSecure Library
          </span>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            aria-label="Send"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-terminal-green text-[var(--color-bg-secondary)] transition-colors hover:bg-terminal-green-dim disabled:cursor-not-allowed disabled:opacity-35"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
