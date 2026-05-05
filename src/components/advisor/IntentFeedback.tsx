'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type IntentType = 'advisor' | 'intake' | 'document' | 'playbook';

const INTENT_LABELS: Record<IntentType, string> = {
  advisor: 'Answer a governance question',
  intake: 'Run a risk assessment',
  document: 'Generate a governance document',
  playbook: 'Create an implementation playbook',
};

interface IntentFeedbackProps {
  query: string;
  detectedIntent: IntentType;
  documentType?: string;
  framework?: string;
  /** Called after user confirms or corrects — parent can dispatch orchestrator */
  onResolved?: (finalIntent: IntentType) => void;
}

export function IntentFeedback({
  query,
  detectedIntent,
  documentType,
  framework,
  onResolved,
}: IntentFeedbackProps) {
  const [state, setState] = useState<'pending' | 'confirmed' | 'correcting' | 'corrected'>('pending');
  const [selectedIntent, setSelectedIntent] = useState<IntentType | null>(null);

  const submitFeedback = async (correctedIntent: IntentType | null) => {
    try {
      await fetch('/api/advisor/intent-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          detectedIntent,
          correctedIntent,
          documentType,
          framework,
        }),
      });
    } catch {
      // Non-blocking — don't disrupt UX for analytics
    }
  };

  const handleConfirm = () => {
    setState('confirmed');
    submitFeedback(null); // null = confirmed correct
    onResolved?.(detectedIntent);
  };

  const handleCorrect = (intent: IntentType) => {
    setSelectedIntent(intent);
    setState('corrected');
    submitFeedback(intent);
    onResolved?.(intent);
  };

  if (state === 'confirmed') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-terminal-green/10 border border-terminal-green/20 text-xs font-mono text-terminal-green">
        <Check className="w-3.5 h-3.5" />
        Intent confirmed: {INTENT_LABELS[detectedIntent]}
      </div>
    );
  }

  if (state === 'corrected' && selectedIntent) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-terminal-cyan/10 border border-terminal-cyan/30 text-xs font-mono text-terminal-cyan">
        <Check className="w-3.5 h-3.5" />
        Updated to: {INTENT_LABELS[selectedIntent]}
      </div>
    );
  }

  if (state === 'correcting') {
    return (
      <div className="px-3 py-2 rounded-md bg-terminal-gray/30 border border-terminal-border text-xs font-mono">
        <p className="text-terminal-muted mb-2">What did you mean?</p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(INTENT_LABELS) as [IntentType, string][])
            .filter(([key]) => key !== detectedIntent)
            .map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleCorrect(key)}
                className="px-3 py-1.5 rounded-md border border-terminal-border text-terminal-text hover:border-terminal-green hover:text-terminal-green transition-colors"
              >
                {label}
              </button>
            ))}
          <button
            onClick={() => setState('pending')}
            className="px-3 py-1.5 rounded-md text-terminal-muted hover:text-terminal-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // pending state
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-terminal-gray/20 border border-terminal-border text-xs font-mono">
      <span className="text-terminal-muted">Detected intent:</span>
      <span className="text-terminal-text font-bold">{INTENT_LABELS[detectedIntent]}</span>
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={handleConfirm}
          className="p-1 rounded-md hover:bg-terminal-green/20 text-terminal-green transition-colors"
          title="Correct"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setState('correcting')}
          className="p-1 rounded-md hover:bg-terminal-red/20 text-terminal-muted hover:text-terminal-red transition-colors"
          title="Not what I meant"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}