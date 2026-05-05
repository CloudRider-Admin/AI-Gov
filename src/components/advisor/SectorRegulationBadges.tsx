'use client';

import { useState } from 'react';
import { Building2, Scale, ChevronDown, ChevronUp } from 'lucide-react';
import type { SectorGuidance } from '@/data/sectorGuidance';
import type { EmergingRegulation } from '@/data/emergingRegulations';

interface SectorRegulationBadgesProps {
  sectors: SectorGuidance[];
  regulations: EmergingRegulation[];
}

const STATUS_COLORS: Record<string, string> = {
  'in-force': 'text-terminal-green border-terminal-green/40 bg-terminal-green/10',
  enacted: 'text-terminal-cyan border-terminal-cyan/40 bg-terminal-cyan/10',
  proposed: 'text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10',
  'final-rule': 'text-terminal-green border-terminal-green/40 bg-terminal-green/10',
};

export function SectorRegulationBadges({ sectors, regulations }: SectorRegulationBadgesProps) {
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const [expandedReg, setExpandedReg] = useState<string | null>(null);

  if (sectors.length === 0 && regulations.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {/* Sector badges */}
      {sectors.length > 0 && (
        <div>
          <p className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            Sector-specific guidance detected
          </p>
          <div className="space-y-2">
            {sectors.map(sector => (
              <div key={sector.id} className="border border-terminal-border rounded bg-terminal-gray/20">
                <button
                  onClick={() => setExpandedSector(expandedSector === sector.id ? null : sector.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-terminal-gray/30 transition-colors"
                >
                  <span className="text-sm font-mono text-terminal-green">{sector.displayName}</span>
                  {expandedSector === sector.id
                    ? <ChevronUp className="w-3.5 h-3.5 text-terminal-muted" />
                    : <ChevronDown className="w-3.5 h-3.5 text-terminal-muted" />
                  }
                </button>
                {expandedSector === sector.id && (
                  <div className="px-3 pb-3 space-y-2 border-t border-terminal-border">
                    <div className="mt-2">
                      <p className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">Key Risks</p>
                      {sector.riskFactors.filter(r => r.severity === 'high').slice(0, 3).map((risk, i) => (
                        <p key={i} className="text-xs font-mono text-terminal-text ml-2">
                          <span className="text-terminal-red">•</span> {risk.factor}: {risk.description}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">Key Regulations</p>
                      {sector.keyRegulations.slice(0, 3).map((reg, i) => (
                        <p key={i} className="text-xs font-mono text-terminal-text ml-2">
                          <span className="text-terminal-green">•</span> {reg.name}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regulation badges */}
      {regulations.length > 0 && (
        <div>
          <p className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Scale className="w-3 h-3" />
            Relevant emerging regulations
          </p>
          <div className="space-y-2">
            {regulations.map(reg => (
              <div key={reg.id} className="border border-terminal-border rounded bg-terminal-gray/20">
                <button
                  onClick={() => setExpandedReg(expandedReg === reg.id ? null : reg.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-terminal-gray/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-terminal-text">{reg.shortName}</span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${STATUS_COLORS[reg.status] ?? 'text-terminal-muted border-terminal-border'}`}>
                      {reg.status}
                    </span>
                  </div>
                  {expandedReg === reg.id
                    ? <ChevronUp className="w-3.5 h-3.5 text-terminal-muted" />
                    : <ChevronDown className="w-3.5 h-3.5 text-terminal-muted" />
                  }
                </button>
                {expandedReg === reg.id && (
                  <div className="px-3 pb-3 space-y-2 border-t border-terminal-border">
                    <p className="text-xs font-mono text-terminal-muted mt-2">{reg.summary.slice(0, 200)}...</p>
                    <div>
                      <p className="text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">Key Provisions</p>
                      {reg.keyProvisions.slice(0, 3).map((p, i) => (
                        <p key={i} className="text-xs font-mono text-terminal-text ml-2">
                          <span className="text-terminal-green">•</span> <strong>{p.provision}</strong>: {p.description}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}