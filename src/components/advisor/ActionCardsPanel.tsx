'use client';

import { Lock, FileText, Shield, BookOpen, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import type { AdvisorResponse } from '@/types/advisor';

export type ActionCardAction =
  | { type: 'intake'; useCaseDescription: string }
  | { type: 'document'; documentType: string; useCaseDescription: string }
  | { type: 'playbook'; framework: string; useCaseDescription: string };

interface ActionCardsPanelProps {
  response: AdvisorResponse;
  query: string;
  isPaidUser: boolean;
  isLoading?: boolean;
  onAction: (action: ActionCardAction) => void;
}

interface CardDef {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: ActionCardAction;
  show: (response: AdvisorResponse) => boolean;
}

function buildCards(query: string, response: AdvisorResponse): CardDef[] {
  const desc = query;
  const regs = response.regulationCheck ?? [];
  const riskLevel = response.riskProfile.level;

  const mentionsGdpr = regs.some((r) => /gdpr|privacy|data protection/i.test(`${r.regulation} ${r.description}`));
  const mentionsSecurity = regs.some((r) => /security|threat|cyber/i.test(`${r.regulation} ${r.description}`));

  return [
    {
      id: 'intake',
      label: 'Run Intake Assessment',
      description: 'Full risk scoring with tier classification',
      icon: <ClipboardCheck className="w-4 h-4" />,
      action: { type: 'intake', useCaseDescription: desc },
      show: () => true,
    },
    {
      id: 'dpia',
      label: 'Generate DPIA',
      description: 'Data Protection Impact Assessment',
      icon: <Shield className="w-4 h-4" />,
      action: { type: 'document', documentType: 'dpia', useCaseDescription: desc },
      show: () => mentionsGdpr || riskLevel === 'high' || riskLevel === 'critical',
    },
    {
      id: 'threat-model',
      label: 'Generate Threat Model',
      description: 'Security threat analysis document',
      icon: <Shield className="w-4 h-4" />,
      action: { type: 'document', documentType: 'threat-model', useCaseDescription: desc },
      show: () => mentionsSecurity || riskLevel === 'high' || riskLevel === 'critical',
    },
    {
      id: 'model-card',
      label: 'Generate Model Card',
      description: 'Standardized model documentation',
      icon: <FileText className="w-4 h-4" />,
      action: { type: 'document', documentType: 'model-card', useCaseDescription: desc },
      show: () => true,
    },
    {
      id: 'playbook',
      label: 'Create Playbook',
      description: 'Implementation roadmap with tasks',
      icon: <BookOpen className="w-4 h-4" />,
      action: { type: 'playbook', framework: 'Combined', useCaseDescription: desc },
      show: () => true,
    },
  ];
}

export function ActionCardsPanel({
  response,
  query,
  isPaidUser,
  isLoading,
  onAction,
}: ActionCardsPanelProps) {
  const cards = buildCards(query, response).filter((c) => c.show(response));

  if (cards.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-mono text-terminal-muted uppercase tracking-wider">
        Generate Documents
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {cards.map((card) => (
          <button
            key={card.id}
            disabled={isLoading || (!isPaidUser)}
            onClick={() => onAction(card.action)}
            className="relative text-left border border-terminal-border rounded-md px-3 py-2.5 hover:border-terminal-green transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-terminal-green">{card.icon}</span>
              <span className="text-sm font-mono text-terminal-text group-hover:text-terminal-green transition-colors">
                {card.label}
              </span>
              {!isPaidUser && <Lock className="w-3 h-3 text-terminal-muted ml-auto" />}
            </div>
            <p className="text-xs font-sans text-terminal-muted leading-relaxed">{card.description}</p>
          </button>
        ))}
      </div>
      {!isPaidUser && (
        <div className="flex items-center gap-2 text-xs text-terminal-muted">
          <Lock className="w-3 h-3" />
          <span className="font-sans">Document generation requires a Pro subscription.</span>
          <Link href="/pricing" className="font-mono text-terminal-green hover:underline">
            Upgrade →
          </Link>
        </div>
      )}
    </div>
  );
}