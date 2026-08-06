import type { AdvisorResponse, RiskLevel } from '@/types/advisor';

export interface RiskVisual {
  label: string;
  /** Tailwind text colour class (theme-aware terminal token). */
  text: string;
  /** Tailwind background colour class for gauge fills / dots. */
  fill: string;
  /** Tailwind soft-tint background for chips. */
  tint: string;
  /** 0–100 bar fill representing exposure. */
  exposure: number;
}

export const RISK_VISUALS: Record<RiskLevel, RiskVisual> = {
  low: { label: 'Low', text: 'text-terminal-green', fill: 'bg-terminal-green', tint: 'bg-terminal-green/10 text-terminal-green', exposure: 20 },
  medium: { label: 'Moderate', text: 'text-terminal-amber', fill: 'bg-terminal-amber', tint: 'bg-terminal-amber/10 text-terminal-amber', exposure: 52 },
  high: { label: 'Elevated', text: 'text-terminal-red', fill: 'bg-terminal-red', tint: 'bg-terminal-red/10 text-terminal-red', exposure: 78 },
  critical: { label: 'Critical', text: 'text-terminal-red', fill: 'bg-terminal-red', tint: 'bg-terminal-red/15 text-terminal-red', exposure: 94 },
};

/**
 * Blend an "audit readiness" score from how confident the assessment is and how
 * contained the risk is. Purely presentational — gives the intelligence panel a
 * meaningful headline gauge without inventing data the model didn't return.
 */
export function readinessScore(response: AdvisorResponse | null): number {
  if (!response || response.mode === 'clarification') return 0;
  const risk = RISK_VISUALS[response.riskProfile.level];
  const confidence = Math.max(0, Math.min(1, response.riskProfile.confidence ?? 0.5));
  const contained = 100 - risk.exposure;
  return Math.round(contained * 0.65 + confidence * 100 * 0.35);
}

export interface DetectedEntity {
  label: string;
  detail?: string;
}

/**
 * Named entities surfaced from the regulation matches — the "Detected Entities"
 * chips (e.g. EU AI Act, Article 12, Annex III). De-duplicated, capped.
 */
export function detectedEntities(response: AdvisorResponse | null, max = 8): DetectedEntity[] {
  if (!response) return [];
  const seen = new Set<string>();
  const out: DetectedEntity[] = [];
  const push = (label?: string, detail?: string) => {
    const clean = label?.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: clean, detail });
  };

  for (const match of response.regulationCheck ?? []) {
    push(match.regulation);
    push(match.article, match.regulation);
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

export interface ReferenceDocument {
  name: string;
  meta?: string;
  kind: 'pdf' | 'doc' | 'source';
}

/** Reference documents / sources for the intelligence panel. */
export function referenceDocuments(response: AdvisorResponse | null, max = 6): ReferenceDocument[] {
  if (!response) return [];
  const structured = response.sourcesStructured ?? [];
  if (structured.length > 0) {
    return structured.slice(0, max).map((s) => ({
      name: s.label,
      meta: s.type ? s.type.replace(/[-_]/g, ' ') : undefined,
      kind: /\.pdf/i.test(s.label) ? 'pdf' : /\.docx?/i.test(s.label) ? 'doc' : 'source',
    }));
  }
  return (response.sources ?? []).slice(0, max).map((label) => ({
    name: label,
    kind: /\.pdf/i.test(label) ? 'pdf' : /\.docx?/i.test(label) ? 'doc' : 'source',
  }));
}

/** Short deterministic session id shown in the header, e.g. "882-GVS". */
export function sessionCode(conversationId: string | null): string {
  const base = conversationId ?? 'guest-session';
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) & 0xffff;
  }
  return `${String(hash % 900 + 100)}-GVS`;
}
