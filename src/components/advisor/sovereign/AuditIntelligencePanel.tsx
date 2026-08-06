'use client';

import { FileText, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import type { AdvisorResponse } from '@/types/advisor';
import {
  RISK_VISUALS,
  readinessScore,
  detectedEntities,
  referenceDocuments,
} from './metrics';

interface AuditIntelligencePanelProps {
  response: AdvisorResponse | null;
  isPaidUser: boolean;
  analyzing: boolean;
}

function Gauge({
  label,
  valueLabel,
  percent,
  fill,
}: {
  label: string;
  valueLabel: string;
  percent: number;
  fill: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
          {label}
        </span>
        <span className="font-mono text-xs font-bold tabular-nums text-terminal-text">{valueLabel}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-terminal-gray/30">
        <div
          className={`h-full rounded-full ${fill} transition-all duration-700 ease-out`}
          style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

const DocIcon = ({ kind }: { kind: 'pdf' | 'doc' | 'source' }) => {
  if (kind === 'pdf') {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-terminal-red/10 font-mono text-xs font-bold text-terminal-red">
        PDF
      </span>
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-terminal-green/10 text-terminal-green">
      <FileText className="h-4 w-4" />
    </span>
  );
};

/**
 * Live governance analysis for the sovereign console — gauges, detected
 * regulatory entities, and cited sources. Rendered as the "Analysis" tab of
 * the console's right-hand panel (see DocumentPanel).
 */
export function AuditIntelligencePanel({ response, isPaidUser, analyzing }: AuditIntelligencePanelProps) {
  const hasAssessment = !!response && response.mode !== 'clarification';
  const risk = hasAssessment ? RISK_VISUALS[response!.riskProfile.level] : null;
  const readiness = readinessScore(response);
  const entities = detectedEntities(response);
  const docs = referenceDocuments(response);

  return (
    <div className="space-y-7 p-5">
      {/* Gauges */}
      <div className="space-y-4">
        <Gauge
          label="Compliance readiness"
          valueLabel={hasAssessment ? `${readiness}%` : '—'}
          percent={hasAssessment ? readiness : 0}
          fill="bg-terminal-green"
        />
        <Gauge
          label="Risk exposure"
          valueLabel={risk ? risk.label.toUpperCase() : '—'}
          percent={risk ? risk.exposure : 0}
          fill={risk ? risk.fill : 'bg-terminal-gray'}
        />
      </div>

      {/* Detected entities */}
      {(entities.length > 0 || analyzing) && (
        <div>
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
            Detected entities
          </p>
          {entities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {entities.map((e) => (
                <span
                  key={e.label}
                  title={e.detail ? `${e.label} · ${e.detail}` : e.label}
                  className="rounded-full border border-terminal-border bg-terminal-gray/30 px-2.5 py-1 font-mono text-xs text-terminal-text"
                >
                  {e.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-terminal-muted">Scanning frameworks…</p>
          )}
        </div>
      )}

      {/* Reference documents */}
      {docs.length > 0 && (
        <div>
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-terminal-muted">
            Reference documents
          </p>
          <div className="space-y-2.5">
            {docs.map((d, i) => (
              <div
                key={`${d.name}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-terminal-border bg-terminal-gray/20 p-3 transition-colors duration-300 hover:border-terminal-green/40"
              >
                <DocIcon kind={d.kind} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-terminal-text">{d.name}</p>
                  {d.meta && (
                    <p className="truncate font-mono text-xs uppercase tracking-wide text-terminal-muted">
                      {d.meta}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasAssessment && entities.length === 0 && docs.length === 0 && !analyzing && (
        <div className="rounded-xl border border-dashed border-terminal-border bg-terminal-gray/20 p-5 text-center">
          <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-terminal-muted" />
          <p className="text-xs leading-relaxed text-terminal-muted">
            Live compliance readiness, detected regulatory entities and cited
            sources will populate here as Govi analyzes your query.
          </p>
        </div>
      )}

      {/* Upsell */}
      {!isPaidUser && (
        <div className="relative overflow-hidden rounded-xl border border-terminal-green/30 bg-terminal-gray/30 p-5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-terminal-green/15 blur-2xl" />
          <div className="relative">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-terminal-green" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terminal-green">
                Upgrade
              </span>
            </div>
            <p className="text-sm font-semibold text-terminal-text">Unlock the full advisor</p>
            <p className="mt-1.5 text-sm leading-relaxed text-terminal-muted">
              Get unlimited assessments, document generation, and priority
              support on a paid plan.
            </p>
            <a href="/pricing" className="btn-primary mt-4 w-full text-sm py-2">
              View plans
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
