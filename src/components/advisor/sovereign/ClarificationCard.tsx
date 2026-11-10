'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react';
import type { FollowUpChoice } from '@/types/advisor';

interface ClarificationCardProps {
  questions: string[];
  /** Index-aligned suggested answers; null/missing = free text only. */
  choices?: (FollowUpChoice | null)[];
  disabled: boolean;
  onSubmit: (answers: { question: string; answer: string }[]) => void;
}

interface AnswerState {
  selected: string[];
  other: string;
  otherOpen: boolean;
}

const EMPTY: AnswerState = { selected: [], other: '', otherOpen: false };

function answerText(a: AnswerState): string {
  const parts = [...a.selected];
  if (a.other.trim()) parts.push(a.other.trim());
  return parts.join(', ');
}

/**
 * Claude-style clarifying questions: one question at a time with a stepper,
 * clickable numbered answers (single or multi-select), a "Something else"
 * free-text row, and Skip. Keyboard: 1–9 picks an option, ↑/↓ moves,
 * Enter continues, ←/→ steps between questions. Submitting sends every
 * answer as a single reply; skipped questions are left out.
 */
export function ClarificationCard({ questions, choices, disabled, onSubmit }: ClarificationCardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() => questions.map(() => ({ ...EMPTY })));
  const [highlight, setHighlight] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const otherRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const total = questions.length;
  const isLastStep = step === total - 1;
  const choice = choices?.[step] ?? null;
  const options = choice?.options ?? [];
  const multi = choice?.multiSelect === true;
  const current = answers[step] ?? EMPTY;
  const freeTextOnly = options.length === 0;
  // Rows: each option, then "Something else".
  const rowCount = options.length + 1;
  const answeredCount = useMemo(() => answers.filter((a) => answerText(a).length > 0).length, [answers]);

  // Reset the keyboard highlight and focus when the question changes.
  useEffect(() => {
    setHighlight(0);
    if (freeTextOnly) otherRef.current?.focus();
    else cardRef.current?.focus({ preventScroll: true });
  }, [step, freeTextOnly]);

  // Focus the inline input when "Something else" opens.
  useEffect(() => {
    if (current.otherOpen) otherRef.current?.focus();
  }, [current.otherOpen]);

  const update = (patch: Partial<AnswerState>) => {
    setAnswers((prev) => prev.map((a, i) => (i === step ? { ...a, ...patch } : a)));
  };

  const submit = (final: AnswerState[]) => {
    const payload = questions
      .map((question, i) => ({ question, answer: answerText(final[i] ?? EMPTY) }))
      .filter((a) => a.answer.length > 0);
    if (payload.length > 0) onSubmit(payload);
  };

  const advance = (final: AnswerState[] = answers) => {
    if (isLastStep) submit(final);
    else setStep((s) => Math.min(total - 1, s + 1));
  };

  const pickOption = (option: string) => {
    if (disabled) return;
    if (multi) {
      const selected = current.selected.includes(option)
        ? current.selected.filter((o) => o !== option)
        : [...current.selected, option];
      update({ selected });
      return;
    }
    // Single choice: select it and move on, like Claude.
    const next = answers.map((a, i) => (i === step ? { ...a, selected: [option], other: '', otherOpen: false } : a));
    setAnswers(next);
    if (!isLastStep) window.setTimeout(() => setStep((s) => Math.min(total - 1, s + 1)), 160);
  };

  const openOther = () => {
    if (disabled) return;
    update(multi ? { otherOpen: true } : { otherOpen: true, selected: [] });
  };

  const skip = () => {
    const next = answers.map((a, i) => (i === step ? { ...EMPTY } : a));
    setAnswers(next);
    advance(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (typing) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape' && !freeTextOnly) {
        update({ otherOpen: false });
        cardRef.current?.focus();
      }
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      const n = Number(e.key) - 1;
      if (n < options.length) pickOption(options[n]);
      else if (n === options.length) openOther();
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      setHighlight((h) => (h + 1) % rowCount);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlight((h) => (h - 1 + rowCount) % rowCount);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && step > 0) {
      setStep(step - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && !isLastStep) {
      setStep(step + 1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (highlight < options.length && !current.selected.includes(options[highlight])) pickOption(options[highlight]);
      else if (highlight === options.length && !current.otherOpen) openOther();
      else advance();
      e.preventDefault();
    }
  };

  const hasAnswer = answerText(current).length > 0;
  const primaryLabel = isLastStep ? 'Submit' : 'Next';
  const primaryDisabled = disabled || (isLastStep ? answeredCount === 0 : !hasAnswer);

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={`Govi's question ${step + 1} of ${total}`}
      className="surface shadow-app mt-5 overflow-hidden rounded-2xl outline-none focus-visible:outline-none"
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-terminal-muted">
            {multi ? 'Select all that apply' : freeTextOnly ? 'Type your answer' : 'Choose one'}
          </p>
          <h3 className="mt-1 text-[15px] font-medium leading-snug text-terminal-text">{questions[step]}</h3>
        </div>
        {total > 1 && (
          <div className="flex flex-none items-center gap-0.5 text-xs tabular-nums text-terminal-muted">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
              aria-label="Previous question"
              className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-terminal-gray hover:text-terminal-text disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1">
              {step + 1} of {total}
            </span>
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={isLastStep}
              aria-label="Next question"
              className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-terminal-gray hover:text-terminal-text disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Answers */}
      <div className="px-3 pb-2">
        {freeTextOnly ? (
          <div className="px-2 pb-1">
            <textarea
              ref={(el) => {
                otherRef.current = el;
              }}
              value={current.other}
              onChange={(e) => update({ other: e.target.value })}
              disabled={disabled}
              rows={2}
              placeholder="Type your answer…"
              className="w-full resize-none rounded-xl border border-terminal-border bg-terminal-black px-3.5 py-2.5 text-sm text-terminal-text outline-none transition-colors placeholder:text-terminal-muted focus:border-terminal-text/30"
            />
          </div>
        ) : (
          <ul role={multi ? 'group' : 'radiogroup'} className="space-y-1">
            {options.map((option, i) => {
              const selected = current.selected.includes(option);
              const highlighted = highlight === i;
              return (
                <li key={option}>
                  <button
                    type="button"
                    role={multi ? 'checkbox' : 'radio'}
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => pickOption(option)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      selected
                        ? 'border-terminal-green/50 bg-terminal-green/[0.07] text-terminal-text'
                        : highlighted
                        ? 'border-terminal-border bg-terminal-gray/60 text-terminal-text'
                        : 'border-transparent text-terminal-text/90'
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 flex-none place-items-center rounded-md text-xs font-medium tabular-nums ${
                        selected ? 'bg-terminal-green text-[var(--color-bg-secondary)]' : 'bg-terminal-gray text-terminal-muted'
                      }`}
                    >
                      {selected && multi ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{option}</span>
                    {selected && !multi && <Check className="h-4 w-4 flex-none text-terminal-green" />}
                  </button>
                </li>
              );
            })}

            {/* Something else */}
            <li>
              {current.otherOpen ? (
                <div className="flex items-center gap-3 rounded-xl border border-terminal-green/50 px-3 py-1.5">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-terminal-gray text-xs font-medium tabular-nums text-terminal-muted">
                    {options.length + 1}
                  </span>
                  <input
                    ref={(el) => {
                      otherRef.current = el;
                    }}
                    value={current.other}
                    onChange={(e) => update({ other: e.target.value })}
                    disabled={disabled}
                    placeholder="Type your answer…"
                    aria-label="Something else"
                    className="min-w-0 flex-1 bg-transparent py-1 text-sm text-terminal-text outline-none placeholder:text-terminal-muted"
                  />
                  <CornerDownLeft className="h-3.5 w-3.5 flex-none text-terminal-muted" aria-hidden="true" />
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={openOther}
                  onMouseEnter={() => setHighlight(options.length)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    highlight === options.length
                      ? 'border-terminal-border bg-terminal-gray/60 text-terminal-text'
                      : 'border-transparent text-terminal-muted'
                  }`}
                >
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-terminal-gray text-xs font-medium tabular-nums text-terminal-muted">
                    {options.length + 1}
                  </span>
                  <span className="min-w-0 flex-1">{current.other.trim() || 'Something else…'}</span>
                </button>
              )}
            </li>
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-terminal-border px-5 py-2.5">
        <p className="hidden text-xs text-terminal-muted sm:block">
          {total > 1 && answeredCount > 0 ? `${answeredCount} of ${total} answered · ` : ''}
          Or reply in your own words below
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={skip}
            disabled={disabled || (isLastStep && answeredCount === 0 && !hasAnswer)}
            className="h-8 rounded-lg px-3 text-sm text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => advance()}
            disabled={primaryDisabled}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-terminal-text px-3.5 text-sm font-medium text-terminal-black transition-opacity hover:opacity-90 disabled:opacity-35"
          >
            {primaryLabel}
            {!isLastStep && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
