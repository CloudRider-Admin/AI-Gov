'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import type { WorkflowState, WorkflowStep, RedFlag } from '@/types/workflows';

interface WorkflowPanelProps {
  sessionId: string;
  /** Header label — defaults to derived from `state.workflowType` if not given. */
  workflowLabel?: string;
  /** Called when finalize succeeds — parent can route the resulting artifact into the conversation. */
  onComplete?: (result: { artifactId: string; document: unknown; summary: unknown }) => void;
  /** Called when the user dismisses an in-progress workflow. */
  onCancel?: () => void;
}

interface FetchedState {
  state: WorkflowState;
  nextStep: WorkflowStep | null;
}

const WORKFLOW_LABELS: Record<string, string> = {
  tprm: 'Third-Party Risk Management',
  '90day-blueprint': '90-Day Blueprint Progress',
  'risk-assessment': 'Risk Assessment',
};

export function WorkflowPanel({ sessionId, workflowLabel, onComplete, onCancel }: WorkflowPanelProps) {
  const [data, setData] = useState<FetchedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<unknown>('');
  const [warning, setWarning] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${sessionId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `Failed (${res.status})`);
      const json = (await res.json()) as FetchedState;
      setData(json);
      setPendingAnswer(initialAnswerFor(json.nextStep));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async () => {
    if (!data?.nextStep) return;
    setSubmitting(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/workflows/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: data.nextStep.sectionId, answer: pendingAnswer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      setData({ state: json.state, nextStep: json.nextStep });
      setPendingAnswer(initialAnswerFor(json.nextStep));
      if (json.warning) setWarning(json.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const finalize = async () => {
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${sessionId}/finalize`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      onComplete?.(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize workflow');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="border border-terminal-border rounded-md p-4 flex items-center gap-2 text-sm font-mono text-terminal-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading workflow…
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="border border-red-500/30 bg-red-500/5 rounded-md p-4 text-sm font-mono text-red-400">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { state, nextStep } = data;
  const headerLabel = workflowLabel ?? WORKFLOW_LABELS[state.workflowType] ?? state.workflowType;
  const progressPct = state.totalSteps === 0 ? 100 : Math.round((state.currentStep / state.totalSteps) * 100);
  const done = nextStep === null || state.status === 'completed';

  return (
    <div className="border border-terminal-cyan/30 rounded-md overflow-hidden bg-terminal-gray/20">
      <div className="flex items-center justify-between px-4 py-2.5 bg-terminal-gray/40 border-b border-terminal-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-terminal-cyan shrink-0">Workflow</span>
          <span className="text-sm font-mono text-terminal-text truncate">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-terminal-muted">
            {state.currentStep}/{state.totalSteps} · {progressPct}%
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-[10px] font-mono text-terminal-muted hover:text-terminal-amber transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="h-1 bg-terminal-border/50">
        <div
          className="h-1 bg-terminal-cyan transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {state.redFlags.length > 0 && <RedFlagList flags={state.redFlags} />}

      <div className="p-4 space-y-3">
        {done ? (
          <DoneView
            state={state}
            finalizing={finalizing}
            onFinalize={finalize}
          />
        ) : (
          <StepView
            step={nextStep!}
            answer={pendingAnswer}
            setAnswer={setPendingAnswer}
            warning={warning}
            error={error}
            submitting={submitting}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}

// ─── Step renderer ──────────────────────────────────────────────────────────

interface StepViewProps {
  step: WorkflowStep;
  answer: unknown;
  setAnswer: (v: unknown) => void;
  warning: string | null;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}

function StepView({ step, answer, setAnswer, warning, error, submitting, onSubmit }: StepViewProps) {
  return (
    <>
      {step.sectionGroup && (
        <p className="text-[10px] font-mono uppercase tracking-wider text-terminal-muted">
          {step.sectionGroup}
        </p>
      )}
      <p className="text-sm font-sans text-terminal-text leading-relaxed">{step.question}</p>
      {step.helpText && (
        <p className="text-xs font-sans text-terminal-muted leading-relaxed">{step.helpText}</p>
      )}

      <StepInput step={step} value={answer} onChange={setAnswer} />

      {warning && (
        <p className="text-xs font-mono text-terminal-amber flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {warning}
        </p>
      )}
      {error && (
        <p className="text-xs font-mono text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {error}
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="flex items-center gap-1.5 text-sm font-mono px-3 py-1.5 border border-terminal-cyan/40 text-terminal-cyan rounded hover:bg-terminal-cyan/10 transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
        {submitting ? 'Saving…' : 'Next'}
      </button>
    </>
  );
}

interface InputProps {
  step: WorkflowStep;
  value: unknown;
  onChange: (v: unknown) => void;
}

function StepInput({ step, value, onChange }: InputProps) {
  const baseClass =
    'w-full text-sm font-mono bg-terminal-black border border-terminal-border rounded px-3 py-2 focus:outline-none focus:border-terminal-cyan';

  switch (step.responseType) {
    case 'longText':
      return (
        <textarea
          rows={5}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      );
    case 'text':
    case 'evidenceLink':
      return (
        <input
          type={step.responseType === 'evidenceLink' ? 'url' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      );
    case 'boolean':
      return (
        <div className="flex gap-2">
          {[true, false].map((b) => (
            <button
              key={String(b)}
              onClick={() => onChange(b)}
              className={`text-xs font-mono px-3 py-1.5 border rounded transition-colors ${
                value === b
                  ? 'border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10'
                  : 'border-terminal-border text-terminal-muted hover:border-terminal-cyan'
              }`}
            >
              {b ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      );
    case 'choice':
      return (
        <div className="flex flex-wrap gap-2">
          {(step.options ?? []).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`text-xs font-mono px-3 py-1.5 border rounded transition-colors ${
                value === opt
                  ? 'border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10'
                  : 'border-terminal-border text-terminal-muted hover:border-terminal-cyan'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    case 'multiChoice': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {(step.options ?? []).map((opt) => {
            const selected = arr.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(selected ? arr.filter((v) => v !== opt) : [...arr, opt]);
                }}
                className={`text-xs font-mono px-3 py-1.5 border rounded transition-colors ${
                  selected
                    ? 'border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10'
                    : 'border-terminal-border text-terminal-muted hover:border-terminal-cyan'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }
    case 'score': {
      const max = step.scoringRubric?.scale.match(/\d+/g)?.map(Number).slice(-1)[0] ?? 5;
      const min = step.scoringRubric?.scale.match(/\d+/g)?.map(Number)[0] ?? 1;
      return (
        <div className="space-y-2">
          {step.scoringRubric?.scale && (
            <p className="text-[10px] font-mono text-terminal-muted">{step.scoringRubric.scale}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                onClick={() => onChange(n)}
                title={step.scoringRubric?.anchors?.[n]}
                className={`text-xs font-mono px-3 py-1.5 border rounded transition-colors ${
                  value === n
                    ? 'border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10'
                    : 'border-terminal-border text-terminal-muted hover:border-terminal-cyan'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      );
    }
  }
}

function initialAnswerFor(step: WorkflowStep | null): unknown {
  if (!step) return '';
  if (step.responseType === 'multiChoice') return [];
  if (step.responseType === 'boolean') return undefined;
  if (step.responseType === 'score') return undefined;
  return '';
}

// ─── Red flags ──────────────────────────────────────────────────────────────

function RedFlagList({ flags }: { flags: RedFlag[] }) {
  return (
    <div className="px-4 py-2 border-b border-terminal-border bg-terminal-amber/5 space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-wider text-terminal-amber">
        Red Flags ({flags.length})
      </p>
      <ul className="space-y-0.5">
        {flags.map((f, i) => (
          <li key={i} className="text-xs font-sans text-terminal-text flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 text-terminal-amber shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">{f.label}</span> — {f.reason}
              <span className="text-[10px] font-mono text-terminal-muted ml-1">[{f.severity}]</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Done view ──────────────────────────────────────────────────────────────

interface DoneViewProps {
  state: WorkflowState;
  finalizing: boolean;
  onFinalize: () => void;
}

function DoneView({ state, finalizing, onFinalize }: DoneViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-terminal-green">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-mono">All {state.totalSteps} questions answered.</span>
      </div>
      <p className="text-xs font-sans text-terminal-muted leading-relaxed">
        Ready to assemble the document. Finalizing will run the workflow finalizer, persist
        the artifact, and surface the result in the conversation.
      </p>
      <button
        onClick={onFinalize}
        disabled={finalizing}
        className="flex items-center gap-1.5 text-sm font-mono px-3 py-1.5 border border-terminal-green/40 text-terminal-green rounded hover:bg-terminal-green/10 transition-colors disabled:opacity-50"
      >
        {finalizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
        {finalizing ? 'Finalizing…' : 'Finalize and generate document'}
      </button>
    </div>
  );
}
