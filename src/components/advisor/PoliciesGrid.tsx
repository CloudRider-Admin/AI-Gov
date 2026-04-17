'use client';

import { BookOpen, Lock, FileText } from 'lucide-react';
import Link from 'next/link';
import { priorityCopy, type PolicyRecommendation } from '@/types/advisor';

interface PoliciesGridProps {
  policies: PolicyRecommendation[];
  gated?: boolean;
  isPaidUser?: boolean;
  onPolicyClick?: (policy: PolicyRecommendation) => void;
}

export function PoliciesGrid({ policies, gated, isPaidUser, onPolicyClick }: PoliciesGridProps) {
  if (!policies.length && !gated) return null;

  const isClickable = (policy: PolicyRecommendation) =>
    !!policy.documentType && !!onPolicyClick && isPaidUser;

  return (
    <div className="mb-6">
      <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4" /> Suggested Policies Draft
      </h4>
      <div className="grid gap-4">
        {policies.map((policy, idx) => {
          const priority = priorityCopy[policy.priority] ?? priorityCopy.medium;
          const clickable = isClickable(policy);

          return (
            <button
              key={`${policy.title}-${idx}`}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onPolicyClick!(policy)}
              className={`text-left border border-terminal-border rounded-md p-4 bg-terminal-gray/30 transition-colors ${
                clickable
                  ? 'cursor-pointer hover:border-terminal-green group'
                  : policy.documentType && onPolicyClick && !isPaidUser
                    ? 'cursor-not-allowed opacity-70'
                    : 'cursor-default'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className={`font-semibold text-terminal-text ${clickable ? 'group-hover:text-terminal-green transition-colors' : ''}`}>
                  {policy.title}
                </p>
                <div className="flex items-center gap-2">
                  {policy.documentType && (
                    <span className="flex items-center gap-1 text-xs font-mono text-terminal-muted">
                      <FileText className="w-3 h-3" />
                      {clickable ? 'Generate' : ''}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full font-mono ${priority.badge}`}>
                    {priority.label}
                  </span>
                </div>
              </div>
              <p className="text-sm text-terminal-muted mb-2">{policy.description}</p>
              <p className="text-xs font-mono text-terminal-muted uppercase tracking-wide">
                Category: {policy.category}
              </p>
            </button>
          );
        })}

        {gated && (
          <div className="border border-dashed border-terminal-border rounded-md p-4 bg-terminal-gray/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-terminal-muted shrink-0" />
              <div>
                <p className="text-sm font-mono text-terminal-muted">More policy recommendations hidden</p>
                <p className="text-xs text-terminal-muted/60 font-mono mt-0.5">Upgrade to Pro for the full analysis</p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 text-xs font-mono px-3 py-1.5 border border-terminal-green text-terminal-green rounded hover:bg-terminal-green/10 transition-colors"
            >
              Upgrade →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
