'use client';

import { useState } from 'react';
import { HelpCircle, Link2, Send } from 'lucide-react';

interface FollowUpsPanelProps {
  questions?: string[];
  sources?: string[];
  onQuestionClick?: (question: string) => void;
  onAnswersSubmit?: (answers: { question: string; answer: string }[]) => void;
}

export function FollowUpsPanel({
  questions = [],
  sources = [],
  onQuestionClick,
  onAnswersSubmit,
}: FollowUpsPanelProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const hasQuestions = questions.length > 0;
  const hasSources = sources.length > 0;

  if (!hasQuestions && !hasSources) return null;

  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;
  const allAnswered = answeredCount === questions.length;

  const handleSubmitAll = () => {
    const collected = questions
      .map((q, idx) => ({ question: q, answer: (answers[idx] ?? '').trim() }))
      .filter((a) => a.answer.length > 0);
    if (collected.length > 0 && onAnswersSubmit) {
      onAnswersSubmit(collected);
      setAnswers({});
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {hasQuestions && (
        <div>
          <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" /> Refine Your Assessment
          </h4>
          <p className="text-xs font-mono text-terminal-muted mb-3">
            Answer the questions below to get a more detailed, tailored assessment:
          </p>
          <div className="grid gap-3">
            {questions.map((question, idx) => (
              <div
                key={`${idx}-${question}`}
                className="rounded-lg border border-terminal-border bg-terminal-gray/20 px-4 py-3"
              >
                <label className="block text-sm font-mono text-terminal-text mb-2">
                  <span className="text-terminal-green mr-2">{idx + 1}.</span>
                  {question}
                </label>
                {onAnswersSubmit ? (
                  <textarea
                    value={answers[idx] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
                    }
                    placeholder="Type your answer here..."
                    className="w-full bg-terminal-bg/50 border border-terminal-border rounded px-3 py-2 text-sm font-mono text-terminal-text placeholder:text-terminal-muted/40 resize-none min-h-[50px] focus:outline-none focus:border-terminal-green transition-colors"
                    rows={2}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onQuestionClick?.(question)}
                    className="text-xs font-mono text-terminal-green hover:underline transition-colors"
                  >
                    Click to answer this question
                  </button>
                )}
              </div>
            ))}
          </div>
          {onAnswersSubmit && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs font-mono text-terminal-muted">
                {answeredCount} of {questions.length} answered
                {!allAnswered && ' — answer all for best results'}
              </p>
              <button
                type="button"
                onClick={handleSubmitAll}
                disabled={answeredCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-mono rounded border border-terminal-green text-terminal-green hover:bg-terminal-green/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Answers
              </button>
            </div>
          )}
        </div>
      )}

      {hasSources && (
        <div>
          <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Sources
          </h4>
          <div className="flex flex-wrap gap-2">
            {sources.map((source, idx) => (
              <span
                key={`${idx}-${source}`}
                className="text-xs font-mono px-3 py-1 border border-terminal-border rounded-full bg-terminal-gray/40 text-terminal-muted"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
