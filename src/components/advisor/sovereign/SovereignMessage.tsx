'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Archive,
  AlertTriangle,
  ShieldCheck,
  Lock,
  GitCompare,
  FileSearch,
  Loader2,
} from 'lucide-react';
import type { AdvisorResponse, PolicyRecommendation } from '@/types/advisor';
import { ArtifactViewer } from '../ArtifactViewer';
import { buildCards, type ActionCardAction } from '../ActionCardsPanel';
import { RISK_VISUALS } from './metrics';

interface SovereignMessageProps {
  query: string;
  response: AdvisorResponse;
  timestamp: string | null;
  isLast: boolean;
  isPaidUser: boolean;
  isActionLoading: boolean;
  onFollowUp?: (question: string) => void;
  onAction: (action: ActionCardAction) => void;
}

const POLICY_ICONS = [Archive, AlertTriangle, ShieldCheck, FileSearch];

function PolicyCard({ policy, index }: { policy: PolicyRecommendation; index: number }) {
  const Icon = POLICY_ICONS[index % POLICY_ICONS.length];
  const isWarn = policy.priority === 'high';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isWarn ? 'text-amber-500' : 'text-emerald-600'}`} />
        <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.12em] text-slate-700">
          {policy.title}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-600">{policy.description}</p>
    </div>
  );
}

export function SovereignMessage({
  query,
  response,
  timestamp,
  isLast,
  isPaidUser,
  isActionLoading,
  onFollowUp,
  onAction,
}: SovereignMessageProps) {
  const isClarification = response.mode === 'clarification';
  const risk = RISK_VISUALS[response.riskProfile.level];
  const policies = (response.suggestedPolicies ?? []).slice(0, 4);
  const followUps = response.followUpQuestions ?? [];
  const cards = buildCards(query, response).filter((c) => c.show(response)).slice(0, 4);
  const artifact = response.generatedArtifact;

  return (
    <div className="space-y-5">
      {/* User message */}
      <div className="flex flex-col items-end">
        <p className="mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-slate-400">
          You{timestamp ? ` · ${timestamp}` : ''}
        </p>
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-slate-100 px-5 py-4">
          <p className="text-[15px] leading-relaxed text-slate-800">{query}</p>
        </div>
      </div>

      {/* Assistant identity */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-xs font-mono font-bold text-white">
          G
        </span>
        <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-slate-500">
          Govi
          {!isClarification && (
            <span className={`ml-2 ${risk.text}`}>· {risk.label} Risk</span>
          )}
        </span>
      </div>

      {/* Assistant card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_20px_rgba(15,23,42,0.05)]">
        {/* Warnings */}
        {response.warnings && response.warnings.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            {response.warnings.map((w, i) => (
              <p key={i} className="text-xs leading-relaxed text-amber-700">
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Narrative */}
        <div className="sovereign-prose text-[15px] leading-relaxed text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {response.riskProfile.description}
          </ReactMarkdown>
        </div>

        {/* Reasoning bullets */}
        {response.riskProfile.reasoning?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {response.riskProfile.reasoning.slice(0, 4).map((r, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-slate-500">
                <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${risk.fill}`} />
                {r}
              </li>
            ))}
          </ul>
        )}

        {/* Policy sub-cards */}
        {policies.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {policies.map((p, i) => (
              <PolicyCard key={`${p.title}-${i}`} policy={p} index={i} />
            ))}
          </div>
        )}

        {/* Generated artifact (schema patch / draft) */}
        {artifact && (
          <div className="mt-5">
            <ArtifactViewer artifact={artifact} />
          </div>
        )}

        {/* Clarification follow-ups */}
        {isClarification && isLast && followUps.length > 0 && (
          <div className="mt-5">
            <p className="mb-2.5 text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-slate-400">
              Govi needs a little more context
            </p>
            <div className="flex flex-col gap-2">
              {followUps.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp?.(q)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-[13px] text-slate-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action toolbar */}
        {!isClarification && !artifact && cards.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="mb-2.5 flex items-center gap-2">
              <GitCompare className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-slate-400">
                Recommended Actions
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  disabled={isActionLoading || !isPaidUser}
                  onClick={() => onAction(card.action)}
                  title={card.description}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-emerald-600">{card.icon}</span>
                  {card.label}
                  {!isPaidUser && <Lock className="h-3 w-3 text-slate-400" />}
                </button>
              ))}
              {isActionLoading && (
                <span className="inline-flex items-center gap-1.5 px-2 text-[13px] text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
                </span>
              )}
            </div>
            {!isPaidUser && (
              <p className="mt-2.5 text-xs text-slate-400">
                Document generation requires a Pro plan.{' '}
                <a href="/pricing" className="font-medium text-emerald-600 hover:underline">
                  Upgrade →
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
