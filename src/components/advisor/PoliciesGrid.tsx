'use client';

import { BookOpen, Lock, FileText, Scale, Shield, Database, Heart, ArrowRight, Tag } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import { priorityCopy, type PolicyRecommendation } from '@/types/advisor';

interface PoliciesGridProps {
  policies: PolicyRecommendation[];
  gated?: boolean;
  isPaidUser?: boolean;
  onPolicyClick?: (policy: PolicyRecommendation) => void;
}

// Category → subtle icon chip. Keeps category discoverable but visually secondary to priority.
const categoryIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  governance: Scale,
  compliance: BookOpen,
  security:   Shield,
  data:       Database,
  ethics:     Heart,
};

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
          const CategoryIcon = categoryIcons[policy.category?.toLowerCase() ?? ''] ?? Tag;

          return (
            <button
              key={`${policy.title}-${idx}`}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onPolicyClick!(policy)}
              className={`text-left border border-terminal-border rounded-xl p-4 bg-terminal-gray/30 transition-colors ${
                clickable
                  ? 'cursor-pointer hover:border-terminal-green group'
                  : policy.documentType && onPolicyClick && !isPaidUser
                    ? 'cursor-not-allowed opacity-70'
                    : 'cursor-default'
              }`}
            >
              {/* Header: title + priority badge (single source of status hierarchy) */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <p className={`font-semibold text-terminal-text ${clickable ? 'group-hover:text-terminal-green transition-colors' : ''}`}>
                  {policy.title}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full font-mono shrink-0 ${priority.badge}`}>
                  {priority.label}
                </span>
              </div>

              {/* Body */}
              <p className="text-sm text-terminal-text font-sans leading-relaxed mb-3">{policy.description}</p>

              {/* Footer: subtle category chip + primary "Generate" affordance when clickable */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-terminal-border/60">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-terminal-muted"
                  title={`Category: ${policy.category}`}
                >
                  <CategoryIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="capitalize">{policy.category}</span>
                </span>
                {policy.documentType && (
                  clickable ? (
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-terminal-green group-hover:translate-x-0.5 transition-transform">
                      <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                      Generate
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  ) : !isPaidUser && onPolicyClick ? (
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-terminal-muted">
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      Pro
                    </span>
                  ) : null
                )}
              </div>
            </button>
          );
        })}

        {gated && (
          <div className="border border-dashed border-terminal-border rounded-xl p-4 bg-terminal-gray/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-terminal-muted shrink-0" />
              <div>
                <p className="text-sm font-sans text-terminal-text">More policy recommendations hidden</p>
                <p className="text-xs text-terminal-muted font-mono mt-0.5">Upgrade to Pro for the full analysis</p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 text-xs font-mono px-3 py-1.5 border border-terminal-green text-terminal-green rounded-md hover:bg-terminal-green/10 transition-colors"
            >
              Upgrade →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}