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
}

export function SovereignInput({
  query,
  isLoading,
  followUpPrompt,
  actionsSlot,
  isPaidUser,
  onChange,
  onSubmit,
}: SovereignInputProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attach, setAttach] = useState<AttachState>({ status: 'idle' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="glass flex items-end gap-2 rounded-xl p-2.5 transition-colors duration-300 focus-within:border-terminal-green/40">
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
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-terminal-muted transition-colors duration-300 hover:bg-terminal-gray/40 hover:text-terminal-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          {attach.status === 'uploading' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </button>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Describe your AI use case, or ask a governance question…"
          disabled={isLoading}
          className="max-h-40 min-h-[40px] flex-grow resize-none self-center bg-transparent px-1 py-2 text-[15px] text-terminal-text outline-none placeholder:text-terminal-muted"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-terminal-green text-terminal-black transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,136,0.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 font-mono text-xs text-terminal-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-terminal-green" />
          Grounded in the GovSecure Library
        </span>
        <span className="hidden font-mono text-xs text-terminal-muted sm:block">
          Press ⌘ + Enter to send
        </span>
      </div>
    </form>
  );
}
