"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Sparkles, ClipboardList } from "lucide-react";
import { ASSESSMENT_QUESTIONS } from "@/lib/assessmentQuestions";

export function AssessmentClient() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tasksCreated: number; score: number } | null>(null);

  const answered = Object.keys(answers).length;
  const total = ASSESSMENT_QUESTIONS.length;
  const complete = answered === total;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="section min-h-screen flex items-center justify-center">
        <div className="glass-card rounded-xl p-8 max-w-md w-full text-center">
          <Sparkles className="w-10 h-10 text-terminal-green mx-auto mb-4" />
          <h1 className="font-mono text-2xl font-bold text-terminal-text mb-2">
            Your baseline: {result.score}/100
          </h1>
          <p className="text-sm text-terminal-muted mb-1">
            We&apos;ve created <strong>{result.tasksCreated}</strong> recommended task
            {result.tasksCreated === 1 ? "" : "s"} to close your gaps.
          </p>
          <p className="text-sm text-terminal-muted mb-6">
            This is your first maturity snapshot — retake it later to track progress.
          </p>
          <div className="flex gap-2">
            <button onClick={() => router.push("/maturity")} className="btn-primary text-sm py-2 flex-1 justify-center">
              View maturity
            </button>
            <button onClick={() => router.push("/tasks")} className="btn-secondary text-sm py-2 flex-1 justify-center">
              See tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section min-h-screen">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 block">
            Onboarding / Assessment
          </span>
          <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-3">
            Governance quick-start
          </h1>
          <p className="text-terminal-muted font-sans">
            Six quick questions. We&apos;ll set your maturity baseline and generate a tailored
            to-do list to close your biggest gaps.
          </p>
        </header>

        <div className="space-y-3 mb-6">
          {ASSESSMENT_QUESTIONS.map((q, i) => (
            <div key={q.id} className="glass-card rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-terminal-muted mt-0.5">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm text-terminal-text mb-3">{q.prompt}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: true })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono transition-colors ${
                        answers[q.id] === true
                          ? "border-terminal-green/50 text-terminal-green bg-terminal-green/10"
                          : "border-terminal-border text-terminal-muted hover:text-terminal-text"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> Yes
                    </button>
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: false })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono transition-colors ${
                        answers[q.id] === false
                          ? "border-terminal-amber/50 text-terminal-amber bg-terminal-amber/10"
                          : "border-terminal-border text-terminal-muted hover:text-terminal-text"
                      }`}
                    >
                      <X className="w-3.5 h-3.5" /> Not yet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center justify-between sticky bottom-4">
          <span className="font-mono text-xs text-terminal-muted flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> {answered}/{total} answered
          </span>
          <button
            onClick={submit}
            disabled={!complete || submitting}
            className="btn-primary text-sm py-2 disabled:opacity-50"
          >
            {submitting ? "Analyzing…" : "Get my roadmap"}
          </button>
        </div>
      </div>
    </div>
  );
}
