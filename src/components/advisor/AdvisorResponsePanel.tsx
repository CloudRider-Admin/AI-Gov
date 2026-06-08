'use client';

import { useState } from 'react';
import { Clock, Copy, Check, Lock, MessageCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { RiskProfileCard } from './RiskProfileCard';
import { PoliciesGrid } from './PoliciesGrid';
import { RegulationsPanel } from './RegulationsPanel';
import { FollowUpsPanel } from './FollowUpsPanel';
import { ActionCardsPanel, type ActionCardAction } from './ActionCardsPanel';
import { ArtifactViewer } from './ArtifactViewer';
import { SectorRegulationBadges } from './SectorRegulationBadges';
import type { AdvisorResponse, PolicyRecommendation } from '@/types/advisor';
import type { SectorGuidance } from '@/data/sectorGuidance';
import type { EmergingRegulation } from '@/data/emergingRegulations';

interface AdvisorResponsePanelProps {
  response: AdvisorResponse;
  submittedQuery: string;
  formattedTimestamp: string | null;
  confidencePercent: string | null;
  onQuestionClick?: (question: string) => void;
  onAnswersSubmit?: (answers: { question: string; answer: string }[]) => void;
  onActionCard?: (action: ActionCardAction) => void;
  showFollowUps?: boolean;
  showActionCards?: boolean;
  isPaidUser?: boolean;
  isActionLoading?: boolean;
  exchangeNumber?: number;
  totalExchanges?: number;
  detectedSectors?: SectorGuidance[];
  detectedRegulations?: EmergingRegulation[];
}

function buildCopyText(query: string, response: AdvisorResponse): string {
  const lines: string[] = [];
  lines.push(`GOVI AI GOVERNANCE ANALYSIS`);
  lines.push(`Query: ${query}`);
  lines.push('');
  lines.push(
    `Risk Level: ${response.riskProfile.level.toUpperCase()}${response.riskProfile.confidence ? ` (${Math.round(response.riskProfile.confidence * 100)}% confidence)` : ''}`
  );
  lines.push(response.riskProfile.description);
  if (response.riskProfile.reasoning?.length) {
    lines.push('');
    lines.push('Reasoning:');
    response.riskProfile.reasoning.forEach((r) => lines.push(`• ${r}`));
  }
  if (response.suggestedPolicies?.length) {
    lines.push('');
    lines.push('Suggested Policies Draft:');
    response.suggestedPolicies.forEach((p) =>
      lines.push(`• [${p.priority.toUpperCase()}] ${p.title}: ${p.description}`)
    );
  }
  if (response.regulationCheck?.length) {
    lines.push('');
    lines.push('Regulations:');
    response.regulationCheck.forEach((r) =>
      lines.push(`• ${r.regulation} ${r.article} (${r.relevance} relevance): ${r.description}`)
    );
  }
  if (response.sources?.length) {
    lines.push('');
    lines.push(`Sources: ${response.sources.join(', ')}`);
  }
  if (response.timestamp) {
    lines.push('');
    lines.push(`Generated: ${new Date(response.timestamp).toLocaleString()}`);
  }
  return lines.join('\n');
}

export function AdvisorResponsePanel({
  response,
  submittedQuery,
  formattedTimestamp,
  confidencePercent,
  onQuestionClick,
  onAnswersSubmit,
  onActionCard,
  showFollowUps = true,
  showActionCards = false,
  isPaidUser = false,
  isActionLoading = false,
  exchangeNumber,
  totalExchanges,
  detectedSectors = [],
  detectedRegulations = [],
}: AdvisorResponsePanelProps) {
  const [copied, setCopied] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({});
  const [clarifyRevealed, setClarifyRevealed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(submittedQuery, response));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const isInThread = totalExchanges !== undefined && totalExchanges > 1;

  return (
    <div className="border-t border-terminal-border pt-6 animate-slide-up space-y-6">
      {/* Query header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isInThread && exchangeNumber && (
            <span className="text-xs font-mono text-terminal-muted uppercase tracking-wider block mb-1">
              Exchange {exchangeNumber} of {totalExchanges}
            </span>
          )}
          {submittedQuery && (
            <div className="text-sm text-terminal-muted font-mono border border-terminal-border bg-terminal-gray/30 rounded px-3 py-2">
              <span className="text-terminal-green mr-2">&gt;</span>
              <span className="text-terminal-text">{submittedQuery}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleCopy}
          title="Copy analysis to clipboard"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-terminal-muted border border-terminal-border rounded hover:border-terminal-green hover:text-terminal-green transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-terminal-green" />
              <span className="text-terminal-green">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* ── Post-processing warning banner (citation validator, etc.) ── */}
      {response.warnings && response.warnings.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-terminal-amber/30 bg-terminal-amber/5 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-terminal-amber shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-semibold text-terminal-amber">
                {response.warnings.length === 1 ? 'Notice' : `${response.warnings.length} notices`}
              </p>
              <ul className="mt-1 space-y-1 text-xs font-sans text-terminal-text">
                {response.warnings.map((w, i) => (
                  <li key={i} className="leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Clarification mode: questionnaire form ── */}
      {response.mode === 'clarification' ? (
        <>
          {/* Clarification context card */}
          <div className="rounded-xl border border-terminal-cyan/30 bg-terminal-cyan/5 p-5">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-terminal-cyan shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-terminal-cyan font-mono">
                  I need a bit more context to give you a tailored assessment
                </p>
                <p className="mt-2 text-sm text-terminal-text font-sans leading-relaxed">
                  {response.riskProfile.description}
                </p>
              </div>
            </div>
          </div>

          {/* Follow-up questions — gated behind the user's opt-in */}
          {response.followUpQuestions?.length > 0 && onAnswersSubmit && !clarifyRevealed && (
            <button
              type="button"
              onClick={() => setClarifyRevealed(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-mono rounded-md border border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 transition-colors"
            >
              Answer {response.followUpQuestions.length} clarifying question{response.followUpQuestions.length > 1 ? 's' : ''}
            </button>
          )}
          {response.followUpQuestions?.length > 0 && onAnswersSubmit && clarifyRevealed && (
            <div className="space-y-4">
              <p className="text-sm font-sans text-terminal-muted">
                Answer the questions below so I can tailor your assessment:
              </p>
              <div className="space-y-3">
                {response.followUpQuestions.map((question, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-terminal-border bg-terminal-gray/30 px-4 py-3"
                  >
                    <label className="block text-sm font-sans text-terminal-text mb-2 leading-relaxed">
                      <span className="text-terminal-green font-mono mr-2" aria-hidden="true">{idx + 1}.</span>
                      {question}
                    </label>
                    <textarea
                      value={clarificationAnswers[idx] ?? ''}
                      onChange={(e) =>
                        setClarificationAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      placeholder="Type your answer here..."
                      className="w-full bg-terminal-black/50 border border-terminal-border rounded-md px-3 py-2 text-sm font-sans text-terminal-text placeholder:text-terminal-muted resize-none min-h-[60px] focus:outline-none focus:border-terminal-green transition-colors"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-terminal-muted">
                  {Object.values(clarificationAnswers).filter((a) => a.trim()).length} of{' '}
                  {response.followUpQuestions.length} answered
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const answers = response.followUpQuestions
                      .map((q, idx) => ({
                        question: q,
                        answer: (clarificationAnswers[idx] ?? '').trim(),
                      }))
                      .filter((a) => a.answer.length > 0);
                    if (answers.length > 0) {
                      onAnswersSubmit(answers);
                      setClarificationAnswers({});
                    }
                  }}
                  disabled={
                    Object.values(clarificationAnswers).filter((a) => a.trim()).length === 0
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-mono rounded-md border border-terminal-green text-terminal-green hover:bg-terminal-green/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Submit Answers
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── Full assessment mode ── */}
          <SectorRegulationBadges sectors={detectedSectors} regulations={detectedRegulations} />
          <RiskProfileCard riskProfile={response.riskProfile} confidencePercent={confidencePercent} />
          <PoliciesGrid
            policies={response.suggestedPolicies}
            gated={response.gated}
            isPaidUser={isPaidUser}
            onPolicyClick={onActionCard ? (policy: PolicyRecommendation) => {
              if (policy.documentType) {
                onActionCard({
                  type: 'document',
                  documentType: policy.documentType,
                  useCaseDescription: submittedQuery,
                });
              }
            } : undefined}
          />
          {response.gated ? (
            <div className="mb-6 border border-dashed border-terminal-border rounded-xl p-4 bg-terminal-gray/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-terminal-muted shrink-0" />
                <div>
                  <p className="text-sm font-sans text-terminal-text">Regulatory mapping hidden</p>
                  <p className="text-xs text-terminal-muted font-mono mt-0.5">GDPR, EU AI Act &amp; NIST analysis available on Pro</p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="shrink-0 text-xs font-mono px-3 py-1.5 border border-terminal-green text-terminal-green rounded-md hover:bg-terminal-green/10 transition-colors"
              >
                Upgrade →
              </Link>
            </div>
          ) : (
            <RegulationsPanel
              regulations={response.regulationCheck}
              sourcesStructured={response.sourcesStructured}
              sources={response.sources}
            />
          )}

          {/* Generated artifact inline viewer */}
          {response.generatedArtifact && (
            <ArtifactViewer artifact={response.generatedArtifact} />
          )}

          {/* Orchestrator error banner */}
          {response.orchestratorError && !response.generatedArtifact && (
            <div className="rounded-xl border border-terminal-amber/30 bg-terminal-amber/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-terminal-amber shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-terminal-amber font-mono">
                    Document generation failed
                  </p>
                  <p className="mt-1 text-sm text-terminal-text font-sans">
                    {response.orchestratorError.message}
                  </p>
                  {response.orchestratorError.retryable && onActionCard && (
                    <button
                      onClick={() => onActionCard({
                        type: response.orchestratorError!.intentType,
                        documentType: '',
                        useCaseDescription: '',
                      } as unknown as ActionCardAction)}
                      className="mt-3 inline-flex items-center gap-1 rounded-md border border-terminal-amber/40 bg-terminal-amber/10 px-3 py-1.5 text-xs font-mono text-terminal-amber hover:bg-terminal-amber/20 transition-colors"
                    >
                      Retry generation
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action cards — shown on last exchange only */}
          {showActionCards && onActionCard && (
            <ActionCardsPanel
              response={response}
              query={submittedQuery}
              isPaidUser={isPaidUser}
              isLoading={isActionLoading}
              onAction={onActionCard}
            />
          )}

          {showFollowUps && (
            <FollowUpsPanel
              questions={response.followUpQuestions}
              sources={response.sources}
              onQuestionClick={onQuestionClick}
              onAnswersSubmit={onAnswersSubmit}
            />
          )}

          {!showFollowUps && response.sources?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {response.sources.map((source, idx) => (
                <span
                  key={idx}
                  className="text-xs font-mono px-3 py-1 border border-terminal-border rounded-full bg-terminal-gray/40 text-terminal-muted"
                >
                  {source}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <div className="text-xs text-terminal-muted font-mono border-t border-terminal-border pt-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>Generated: {formattedTimestamp ?? 'just now'}</span>
        </div>
        <span className="opacity-50">ID: {response.conversationId}</span>
      </div>

      <p className="text-xs text-terminal-muted font-mono flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        This is a preliminary assessment. Consult governance counsel for binding advice.
      </p>
    </div>
  );
}
