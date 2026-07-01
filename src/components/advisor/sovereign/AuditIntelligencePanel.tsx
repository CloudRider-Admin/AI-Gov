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
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <span className="text-[11px] font-mono font-bold text-slate-700">{valueLabel}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
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
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-[9px] font-mono font-bold text-red-500">
        PDF
      </span>
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
      <FileText className="h-4 w-4" />
    </span>
  );
};

export function AuditIntelligencePanel({ response, isPaidUser, analyzing }: AuditIntelligencePanelProps) {
  const hasAssessment = !!response && response.mode !== 'clarification';
  const risk = hasAssessment ? RISK_VISUALS[response!.riskProfile.level] : null;
  const readiness = readinessScore(response);
  const entities = detectedEntities(response);
  const docs = referenceDocuments(response);

  return (
    <aside className="w-full shrink-0 border-t border-slate-200/80 bg-white lg:h-full lg:w-[340px] lg:overflow-y-auto lg:border-l lg:border-t-0">
      <div className="space-y-7 p-6">
        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">
          Audit Intelligence Panel
        </h2>

        {/* Gauges */}
        <div className="space-y-4">
          <Gauge
            label="Compliance Readiness"
            valueLabel={hasAssessment ? `${readiness}%` : '—'}
            percent={hasAssessment ? readiness : 0}
            fill="bg-emerald-500"
          />
          <Gauge
            label="Risk Exposure"
            valueLabel={risk ? risk.label.toUpperCase() : '—'}
            percent={risk ? risk.exposure : 0}
            fill={risk ? risk.fill : 'bg-slate-300'}
          />
        </div>

        {/* Detected entities */}
        {(entities.length > 0 || analyzing) && (
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
              Detected Entities
            </p>
            {entities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {entities.map((e) => (
                  <span
                    key={e.label}
                    title={e.detail ? `${e.label} · ${e.detail}` : e.label}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    {e.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-mono">Scanning frameworks…</p>
            )}
          </div>
        )}

        {/* Reference documents */}
        {docs.length > 0 && (
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
              Reference Documents
            </p>
            <div className="space-y-2.5">
              {docs.map((d, i) => (
                <div
                  key={`${d.name}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-shadow hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]"
                >
                  <DocIcon kind={d.kind} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">{d.name}</p>
                    {d.meta && (
                      <p className="truncate text-[11px] font-mono uppercase tracking-wide text-slate-400">
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
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
            <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Live compliance readiness, detected regulatory entities and cited
              sources will populate here as Govi analyzes your query.
            </p>
          </div>
        )}

        {/* Enterprise upsell */}
        {!isPaidUser && (
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative">
              <div className="mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-emerald-400">
                  Enterprise
                </span>
              </div>
              <p className="text-[15px] font-semibold">Upgrade to Enterprise Audit</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
                Unlock real-time legal council integration and automated
                regulatory filing.
              </p>
              <a
                href="/pricing"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
              >
                View Plans
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
