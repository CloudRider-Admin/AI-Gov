'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, X, Plus, Trash2 } from 'lucide-react';
import { OCCUPATIONAL_ROLES } from '@/lib/occupationalRoles';
import { ASSESSMENT_QUESTIONS } from '@/lib/assessmentQuestions';

const TOTAL_STEPS = 4;

const INDUSTRIES = [
  { value: 'healthcare', label: 'Healthcare / Life sciences' },
  { value: 'financial-services', label: 'Financial services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'technology', label: 'Technology / SaaS' },
  { value: 'retail', label: 'Retail / E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'education', label: 'Education' },
  { value: 'government', label: 'Government / Public sector' },
  { value: 'legal', label: 'Legal / Professional services' },
  { value: 'media', label: 'Media / Marketing' },
  { value: 'other', label: 'Other' },
];

const SIZE_BANDS = [
  { value: '1-10', label: '1–10 people' },
  { value: '11-50', label: '11–50 people' },
  { value: '51-200', label: '51–200 people' },
  { value: '201-1000', label: '201–1,000 people' },
  { value: '1000+', label: '1,000+ people' },
];

const JURISDICTIONS = [
  { value: 'EU', label: 'European Union' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'other', label: 'Other / Multiple regions' },
];

const AI_TOOLS = [
  'ChatGPT / OpenAI',
  'Microsoft Copilot',
  'Google Gemini',
  'Anthropic Claude',
  'GitHub Copilot',
  'Perplexity',
  'Custom / in-house AI models',
  'AI in HR / recruiting',
  'AI in customer support',
  'AI in marketing / content',
  'AI in sales / CRM',
  'AI in finance / operations',
];

type UseCaseRow = { id: number; name: string; purpose: string };

let useCaseIdSeq = 0;
const emptyUseCase = (): UseCaseRow => ({ id: ++useCaseIdSeq, name: '', purpose: '' });

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — organizational profile
  const [orgName, setOrgName] = useState('');
  const [orgIndustry, setOrgIndustry] = useState('');
  const [orgSize, setOrgSize] = useState('');
  const [orgJurisdiction, setOrgJurisdiction] = useState('');
  const [role, setRole] = useState('');

  // Step 2 — readiness assessment
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  // Step 3 — AI tool inventory
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Step 4 — initial use-case inventory
  const [useCases, setUseCases] = useState<UseCaseRow[]>(() => [emptyUseCase()]);

  const toggleTool = (tool: string) =>
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );

  const setAnswer = (id: string, value: boolean) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const updateUseCase = (id: number, patch: Partial<UseCaseRow>) =>
    setUseCases((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const addUseCase = () => setUseCases((prev) => [...prev, emptyUseCase()]);
  const removeUseCase = (id: number) =>
    setUseCases((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)));

  const step1Valid = orgName.trim().length > 0 && role.length > 0;
  const allAnswered = ASSESSMENT_QUESTIONS.every((q) => typeof answers[q.id] === 'boolean');

  /**
   * Persist everything captured so far. Each subsystem is written independently
   * so a failure in one (e.g. the assessment) never blocks the others or the
   * wizard from closing.
   */
  const persistAll = async () => {
    const filledUseCases = useCases.filter((u) => u.name.trim().length > 0);

    // 1. Organizational profile + AI tool inventory + role. Also flips
    //    onboardingCompleted so the wizard does not reappear.
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim() || undefined,
          orgIndustry: orgIndustry || undefined,
          orgSize: orgSize || undefined,
          orgJurisdiction: orgJurisdiction || undefined,
          occupationalRole: role || undefined,
          aiTools: selectedTools,
        }),
      });
    } catch (err) {
      console.error('Failed to persist onboarding profile', err);
    }

    // 2. Readiness assessment — only submit when every question is answered,
    //    so a partial pass does not seed misleading remediation tasks.
    if (allAnswered) {
      try {
        await fetch('/api/assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
      } catch (err) {
        console.error('Failed to submit readiness assessment', err);
      }
    }

    // 3. Initial use-case inventory — one AI system register entry per use case.
    for (const useCase of filledUseCases) {
      try {
        await fetch('/api/ai-systems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: useCase.name.trim(),
            purpose: useCase.purpose.trim() || undefined,
            entityKind: 'use-case',
            lifecycleStage: 'idea',
          }),
        });
      } catch (err) {
        console.error('Failed to register use case', err);
      }
    }
  };

  const finish = async (destination: string) => {
    if (submitting) return;
    setSubmitting(true);
    await persistAll();
    onComplete();
    router.push(destination);
  };

  const stepLabel = `Step ${step} of ${TOTAL_STEPS}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-terminal-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg terminal-window glow-green">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-4 text-xs text-terminal-muted font-mono">client_onboarding.sh</span>
          <button
            onClick={() => finish('/')}
            className="ml-auto text-terminal-muted hover:text-terminal-text transition-colors"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  step >= i + 1 ? 'bg-terminal-green' : 'bg-terminal-border'
                }`}
              />
            ))}
          </div>

          {/* ── Step 1 — Organizational profile ── */}
          {step === 1 && (
            <>
              <p className="font-mono text-terminal-green text-xs uppercase tracking-wider mb-1">{stepLabel}</p>
              <h2 className="font-mono text-lg font-bold text-terminal-text mb-1">
                Tell us about your organization
              </h2>
              <p className="text-sm text-terminal-muted font-sans mb-5">
                This anchors your governance program, risk tiering, and the regulations we map to.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="ob-orgname" className="block font-mono text-xs text-terminal-muted uppercase tracking-wider mb-1.5">
                    Organization name
                  </label>
                  <input
                    id="ob-orgname"
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 rounded border border-terminal-border bg-terminal-black font-mono text-sm text-terminal-text focus:border-terminal-green focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="ob-industry" className="block font-mono text-xs text-terminal-muted uppercase tracking-wider mb-1.5">
                    Industry
                  </label>
                  <select
                    id="ob-industry"
                    value={orgIndustry}
                    onChange={(e) => setOrgIndustry(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-terminal-border bg-terminal-black font-mono text-sm text-terminal-text focus:border-terminal-green focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {INDUSTRIES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ob-size" className="block font-mono text-xs text-terminal-muted uppercase tracking-wider mb-1.5">
                    Organization size
                  </label>
                  <select
                    id="ob-size"
                    value={orgSize}
                    onChange={(e) => setOrgSize(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-terminal-border bg-terminal-black font-mono text-sm text-terminal-text focus:border-terminal-green focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {SIZE_BANDS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ob-jurisdiction" className="block font-mono text-xs text-terminal-muted uppercase tracking-wider mb-1.5">
                    Primary jurisdiction
                  </label>
                  <select
                    id="ob-jurisdiction"
                    value={orgJurisdiction}
                    onChange={(e) => setOrgJurisdiction(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-terminal-border bg-terminal-black font-mono text-sm text-terminal-text focus:border-terminal-green focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {JURISDICTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ob-role" className="block font-mono text-xs text-terminal-muted uppercase tracking-wider mb-1.5">
                    Your role
                  </label>
                  <select
                    id="ob-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-terminal-border bg-terminal-black font-mono text-sm text-terminal-text focus:border-terminal-green focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {OCCUPATIONAL_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button onClick={() => finish('/')} className="text-xs font-mono text-terminal-muted hover:text-terminal-text transition-colors">
                  Skip for now
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!step1Valid}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-terminal-green text-terminal-black font-mono text-sm font-bold rounded hover:bg-terminal-green/90 transition-colors disabled:opacity-50"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Step 2 — Readiness assessment ── */}
          {step === 2 && (
            <>
              <p className="font-mono text-terminal-green text-xs uppercase tracking-wider mb-1">{stepLabel}</p>
              <h2 className="font-mono text-lg font-bold text-terminal-text mb-1">
                Governance readiness check
              </h2>
              <p className="text-sm text-terminal-muted font-sans mb-5">
                Six quick questions. Every &ldquo;No&rdquo; becomes a recommended remediation task on your dashboard.
              </p>

              <div className="space-y-3 mb-6">
                {ASSESSMENT_QUESTIONS.map((q) => (
                  <div key={q.id} className="rounded border border-terminal-border p-3">
                    <p className="text-sm font-sans text-terminal-text mb-2.5">{q.prompt}</p>
                    <div className="flex gap-2">
                      {([
                        { value: true, label: 'Yes' },
                        { value: false, label: 'No' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => setAnswer(q.id, opt.value)}
                          className={`flex-1 px-3 py-1.5 rounded border font-mono text-xs transition-colors ${
                            answers[q.id] === opt.value
                              ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
                              : 'border-terminal-border text-terminal-muted hover:border-terminal-green/50 hover:text-terminal-text'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <button onClick={() => setStep(1)} className="text-xs font-mono text-terminal-muted hover:text-terminal-text transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-terminal-green text-terminal-black font-mono text-sm font-bold rounded hover:bg-terminal-green/90 transition-colors"
                >
                  {allAnswered ? 'Next' : 'Skip rest'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Step 3 — AI tool inventory ── */}
          {step === 3 && (
            <>
              <p className="font-mono text-terminal-green text-xs uppercase tracking-wider mb-1">{stepLabel}</p>
              <h2 className="font-mono text-lg font-bold text-terminal-text mb-1">
                Which AI tools are in use?
              </h2>
              <p className="text-sm text-terminal-muted font-sans mb-5">
                Select everything your teams use today — approved or not. Select all that apply.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {AI_TOOLS.map((tool) => (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`text-left px-3 py-2.5 rounded border font-mono text-xs transition-colors ${
                      selectedTools.includes(tool)
                        ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
                        : 'border-terminal-border text-terminal-muted hover:border-terminal-green/50 hover:text-terminal-text'
                    }`}
                  >
                    {selectedTools.includes(tool) ? '✓ ' : ''}{tool}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <button onClick={() => setStep(2)} className="text-xs font-mono text-terminal-muted hover:text-terminal-text transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-terminal-green text-terminal-black font-mono text-sm font-bold rounded hover:bg-terminal-green/90 transition-colors"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Step 4 — Initial use-case inventory ── */}
          {step === 4 && (
            <>
              <p className="font-mono text-terminal-green text-xs uppercase tracking-wider mb-1">{stepLabel}</p>
              <h2 className="font-mono text-lg font-bold text-terminal-text mb-1">
                Your initial AI use cases
              </h2>
              <p className="text-sm text-terminal-muted font-sans mb-5">
                List the AI use cases you want governed first. Each becomes an entry in your AI system register, ready for Gate 1.
              </p>

              <div className="space-y-3 mb-4">
                {useCases.map((row) => (
                  <div key={row.id} className="rounded border border-terminal-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateUseCase(row.id, { name: e.target.value })}
                        placeholder="Use case name (e.g. Support ticket triage)"
                        className="flex-1 px-3 py-2 rounded border border-terminal-border bg-terminal-black font-mono text-sm text-terminal-text focus:border-terminal-green focus:outline-none"
                      />
                      {useCases.length > 1 && (
                        <button
                          onClick={() => removeUseCase(row.id)}
                          className="text-terminal-muted hover:text-terminal-red transition-colors"
                          aria-label="Remove use case"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={row.purpose}
                      onChange={(e) => updateUseCase(row.id, { purpose: e.target.value })}
                      placeholder="What it does / who it affects (optional)"
                      className="w-full px-3 py-2 rounded border border-terminal-border bg-terminal-black font-mono text-xs text-terminal-muted focus:border-terminal-green focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={addUseCase}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-terminal-green hover:underline mb-6"
              >
                <Plus className="w-3.5 h-3.5" /> Add another use case
              </button>

              <div className="flex justify-between items-center">
                <button onClick={() => setStep(3)} className="text-xs font-mono text-terminal-muted hover:text-terminal-text transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => finish('/maturity')}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-terminal-green text-terminal-black font-mono text-sm font-bold rounded hover:bg-terminal-green/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Finishing…' : 'Finish setup'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
