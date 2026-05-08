'use client';

import { Lock, FileText, Shield, BookOpen, ClipboardCheck, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { AdvisorResponse } from '@/types/advisor';
import {
  getDocumentTypeMeta,
  getCategoryBadgeClass,
  getCategoryLabel,
  isGovSecureType,
} from './documentTypeMeta';

export type ActionCardAction =
  | { type: 'intake'; useCaseDescription: string }
  | { type: 'document'; documentType: string; useCaseDescription: string }
  | { type: 'playbook'; framework: string; useCaseDescription: string }
  | { type: 'workflow'; workflowType: 'tprm'; useCaseDescription: string };

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

function docCard(
  id: string,
  documentType: string,
  desc: string,
  icon: React.ReactNode,
  show: CardDef['show'],
): CardDef {
  const meta = getDocumentTypeMeta(documentType);
  return {
    id,
    label: meta.label,
    description: meta.blurb,
    icon,
    action: { type: 'document', documentType, useCaseDescription: desc },
    show,
  };
}

function buildCards(query: string, response: AdvisorResponse): CardDef[] {
  const desc = query;
  const regs = response.regulationCheck ?? [];
  const riskLevel = response.riskProfile.level;

  const mentionsGdpr = regs.some((r) => /gdpr|privacy|data protection/i.test(`${r.regulation} ${r.description}`));
  const mentionsSecurity = regs.some((r) => /security|threat|cyber/i.test(`${r.regulation} ${r.description}`));
  const mentionsVendor = /\b(vendor|third[-\s]?party|supplier|saas)\b/i.test(`${query} ${regs.map((r) => r.description).join(' ')}`);
  const isHighRisk = riskLevel === 'high' || riskLevel === 'critical';

  return [
    {
      id: 'intake',
      label: 'Run Intake Assessment',
      description: 'Full risk scoring with tier classification',
      icon: <ClipboardCheck className="w-4 h-4" />,
      action: { type: 'intake', useCaseDescription: desc },
      show: () => true,
    },
    docCard('dpia', 'dpia', desc, <Shield className="w-4 h-4" />, () => mentionsGdpr || isHighRisk),
    docCard('threat-model', 'threat-model', desc, <Shield className="w-4 h-4" />, () => mentionsSecurity || isHighRisk),
    docCard('model-card', 'model-card', desc, <FileText className="w-4 h-4" />, () => true),
    docCard('govsecure-aup', 'govsecure-aup', desc, <ShieldCheck className="w-4 h-4" />, () => true),
    docCard('govsecure-tprm', 'govsecure-tprm', desc, <ShieldCheck className="w-4 h-4" />, () => mentionsVendor),
    {
      id: 'tprm-workflow',
      label: 'Walk through TPRM (multi-turn)',
      description: 'Step-by-step third-party risk questionnaire with red-flag callouts',
      icon: <ClipboardCheck className="w-4 h-4" />,
      action: { type: 'workflow', workflowType: 'tprm', useCaseDescription: desc },
      show: () => mentionsVendor,
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

function categoryBadgeForAction(action: ActionCardAction): { label: string; className: string } | null {
  if (action.type === 'document' && isGovSecureType(action.documentType)) {
    const meta = getDocumentTypeMeta(action.documentType);
    return { label: getCategoryLabel(meta.category), className: getCategoryBadgeClass(meta.category) };
  }
  return null;
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
        {cards.map((card) => {
          const badge = categoryBadgeForAction(card.action);
          return (
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
              {badge && (
                <span className={`inline-block mt-2 text-[10px] font-mono px-1.5 py-0.5 rounded ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </button>
          );
        })}
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