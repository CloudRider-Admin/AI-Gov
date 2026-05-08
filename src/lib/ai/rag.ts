import { knowledgeBase } from './knowledgeBase';
import { searchNistPlaybook, type NistEntry } from './nistIndex';
import { prisma } from '@/lib/prisma';
import { matchSectors } from '@/data/sectorGuidance';
import { matchRegulations } from '@/data/emergingRegulations';
import { semanticSearch, isVectorSearchAvailable } from './vectorSearch';

import type { KnowledgeDocument } from './knowledgeBase';

export interface KnowledgeContextResult {
  context: string | null;
  documents: KnowledgeDocument[];
}

/**
 * Provenance bucket for each source. Drives UI grouping / badges and the
 * citation-validator's manifest path so consumers don't have to string-match
 * against the human label.
 */
export type SourceProvenanceType =
  | 'govsecure'
  | 'nist'
  | 'static-kb'
  | 'vector-kb'
  | 'db-kb'
  | 'sector-guidance'
  | 'regulation';

export interface SourceProvenance {
  /** Display label — same human string the legacy flat `sources[]` carries. */
  label: string;
  /** Provenance bucket. */
  type: SourceProvenanceType;
  /** Free-form sub-label (tag chain, control id, etc.). Optional. */
  anchor?: string;
}

export interface EnhancedRAGResult {
  context: string | null;
  documents: KnowledgeDocument[];
  /**
   * Flat label list. Kept for back-compat with consumers (and for the legacy
   * AdvisorResponse.sources field). Always equal to
   * `sourcesStructured.map(s => s.label)`.
   */
  sources: string[];
  /**
   * Structured provenance. Always emitted by `buildEnhancedRAGContext`;
   * marked optional only because legacy callers pass stub `EnhancedRAGResult`
   * objects (e.g. clarification fallback, response-parser tests) that
   * pre-date the structured field. Consumers should treat `undefined` as
   * "no structured info; fall back to the flat `sources` list".
   */
  sourcesStructured?: SourceProvenance[];
}

// ── Unified scored candidate for dynamic allocation ──

type SourceKind = 'vector' | 'static' | 'nist' | 'db';

interface ScoredCandidate {
  kind: SourceKind;
  key: string;          // dedup key (lowercased title)
  score: number;        // normalised 0-1
  title: string;
  snippet: string;
  sourceLabel: string;
  /** Original data for rich formatting */
  raw: KnowledgeDocument | NistEntry | DbEntry;
}

interface DbEntry {
  title: string;
  content: string;
  category: string;
  tags: string[];
  /** Optional sourceType column from KnowledgeEntry; missing on DBs that haven't been re-seeded. */
  sourceType?: string | null;
}

const GOVSECURE_SOURCE_TYPE = 'govsecure';
const GOVSECURE_LIBRARY_LABEL = 'GovSecure Governance Library';

function isGovSecureEntry(e: DbEntry): boolean {
  return e.sourceType === GOVSECURE_SOURCE_TYPE;
}

/**
 * Build a structured anchor from the entry tags so citations carry more than
 * just the title. Tags like ["AI Chef", "Station 2"] surface as
 * "GovSecure Governance Library — Title (AI Chef · Station 2)".
 */
function buildGovSecureAnchor(e: DbEntry): string {
  const tagBits = (e.tags ?? []).slice(0, 3).filter(Boolean);
  const anchor = tagBits.length ? ` (${tagBits.join(' · ')})` : '';
  return `${GOVSECURE_LIBRARY_LABEL} — ${e.title}${anchor}`;
}

function createSnippet(content: string, length = 400): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, length) + (content.length > length ? '…' : '');
}

/**
 * Build enhanced RAG context with **dynamic source allocation**.
 *
 * Instead of fixed per-source limits (old: 2 static + 3 NIST + 2 DB),
 * all candidate sources are scored and merged into a single ranked pool.
 * The top `totalBudget` candidates are selected regardless of source type,
 * ensuring the most relevant content always makes it into context.
 *
 * Sector guidance and emerging regulations are appended separately as they
 * are always included when matched (not competing for the main budget).
 */
export async function buildEnhancedRAGContext(
  query: string,
  options: {
    /** Total number of knowledge snippets to include (default 7) */
    totalBudget?: number;
    /** Max candidates to fetch per source before ranking (default 5) */
    candidatesPerSource?: number;
    // Legacy compat — ignored if totalBudget is set
    staticLimit?: number;
    nistLimit?: number;
    dbLimit?: number;
  } = {}
): Promise<EnhancedRAGResult> {
  const totalBudget = options.totalBudget ?? 7;
  const perSource = options.candidatesPerSource ?? 5;
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const candidates: ScoredCandidate[] = [];

  // ── 1. Vector search (highest quality — semantic match) ──
  let usedVectorSearch = false;
  try {
    const vectorAvailable = await isVectorSearchAvailable();
    if (vectorAvailable) {
      const vectorDocs = await semanticSearch(query, { limit: perSource, threshold: 0.3 });
      usedVectorSearch = vectorDocs.length > 0;
      for (const doc of vectorDocs) {
        candidates.push({
          kind: 'vector',
          key: doc.title.toLowerCase(),
          score: doc.relevanceScore ?? 0.5,
          title: doc.title,
          snippet: createSnippet(doc.content),
          sourceLabel: `[Vector] ${doc.source}`,
          raw: doc,
        });
      }
    }
  } catch {
    // Non-fatal
  }

  // ── 2. Static knowledge base (keyword) ──
  const staticResult = knowledgeBase.search(query, undefined, perSource);
  const maxStaticScore = Math.max(...staticResult.documents.map(d => d.relevanceScore ?? 0), 1);
  for (const doc of staticResult.documents) {
    candidates.push({
      kind: 'static',
      key: doc.title.toLowerCase(),
      score: (doc.relevanceScore ?? 0) / maxStaticScore, // normalise to 0-1
      title: doc.title,
      snippet: createSnippet(doc.content),
      sourceLabel: doc.source,
      raw: doc,
    });
  }

  // ── 3. NIST playbook (pre-indexed) ──
  const nistResults = searchNistPlaybook(query, perSource);
  // Score normalisation: first result is highest, linearly decay
  for (let i = 0; i < nistResults.length; i++) {
    const e = nistResults[i];
    candidates.push({
      kind: 'nist',
      key: e.title.toLowerCase(),
      score: 1 - (i / Math.max(nistResults.length, 1)) * 0.5, // 1.0 → 0.5
      title: e.title,
      snippet: createSnippet(e.description + (e.section_about ? ' ' + e.section_about : '')),
      sourceLabel: `NIST AI RMF — ${e.title}`,
      raw: e,
    });
  }

  // ── 4. DB knowledge entries (only if no vector search) ──
  if (!usedVectorSearch) {
    try {
      const allEntries = await prisma.knowledgeEntry.findMany({
        where: { isActive: true },
        select: { title: true, content: true, category: true, tags: true, sourceType: true },
      });
      const scored = allEntries
        .map((entry: DbEntry) => {
          const text = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
          const score = queryTerms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
          return { entry, score };
        })
        .filter(({ score }: { score: number }) => score > 0)
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, perSource);

      const maxDbScore = Math.max(...scored.map((s: { score: number }) => s.score), 1);
      for (const { entry, score } of scored) {
        const govsecure = isGovSecureEntry(entry);
        candidates.push({
          kind: 'db',
          key: entry.title.toLowerCase(),
          score: score / maxDbScore,
          title: entry.title,
          snippet: createSnippet(entry.content),
          sourceLabel: govsecure
            ? buildGovSecureAnchor(entry)
            : `Knowledge Base — ${entry.title}`,
          raw: entry,
        });
      }
    } catch {
      // Non-fatal
    }
  }

  // ── Deduplicate by key (prefer higher-scoring source) ──
  const seen = new Map<string, ScoredCandidate>();
  // Sort all candidates by score descending first
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (!seen.has(c.key)) {
      seen.set(c.key, c);
    }
  }

  // ── Take top N from unified pool ──
  const selected = [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, totalBudget);

  // ── Sector & regulation matches (additive, not competing for budget) ──
  const sectorMatches = matchSectors(query);
  const regulationMatches = matchRegulations(query, 2);

  // ── Build structured sources list (flat list derives from it) ──
  const provenanceTypeForCandidate = (c: ScoredCandidate): SourceProvenanceType => {
    if (c.kind === 'db' && isGovSecureEntry(c.raw as DbEntry)) return 'govsecure';
    if (c.kind === 'db') return 'db-kb';
    if (c.kind === 'nist') return 'nist';
    if (c.kind === 'vector') return 'vector-kb';
    if (c.kind === 'static') return 'static-kb';
    return 'db-kb';
  };

  const anchorForCandidate = (c: ScoredCandidate): string | undefined => {
    if (c.kind === 'db' && isGovSecureEntry(c.raw as DbEntry)) {
      const tags = ((c.raw as DbEntry).tags ?? []).slice(0, 3).filter(Boolean);
      return tags.length ? tags.join(' · ') : undefined;
    }
    if (c.kind === 'nist') return (c.raw as NistEntry).category ?? undefined;
    return undefined;
  };

  const sourcesStructured: SourceProvenance[] = [
    ...selected.map((c) => ({
      label: c.sourceLabel,
      type: provenanceTypeForCandidate(c),
      ...(anchorForCandidate(c) ? { anchor: anchorForCandidate(c)! } : {}),
    })),
    ...sectorMatches.map((s) => ({
      label: `Sector Guidance — ${s.displayName}`,
      type: 'sector-guidance' as const,
    })),
    ...regulationMatches.map((r) => ({
      label: r.name,
      type: 'regulation' as const,
    })),
  ];

  const sources: string[] = sourcesStructured.map((s) => s.label);

  // ── Format context ──
  const parts: string[] = [];

  // Group selected by kind for clean formatting
  const byKind = (kind: SourceKind) => selected.filter(c => c.kind === kind);

  const vectorSelected = byKind('vector');
  if (vectorSelected.length) {
    parts.push(
      'Semantically matched knowledge documents:\n' +
      vectorSelected
        .map((c, i) => {
          const doc = c.raw as KnowledgeDocument;
          return `${i + 1}. ${doc.title} (Source: ${doc.source}, Relevance: ${(c.score * 100).toFixed(0)}%)\n${c.snippet}`;
        })
        .join('\n\n')
    );
  }

  const staticSelected = byKind('static');
  if (staticSelected.length) {
    parts.push(
      'Relevant governance knowledge base documents:\n' +
      staticSelected
        .map((c, i) => {
          const doc = c.raw as KnowledgeDocument;
          return `${i + 1}. ${doc.title} (Source: ${doc.source})\n${c.snippet}`;
        })
        .join('\n\n')
    );
  }

  const nistSelected = byKind('nist');
  if (nistSelected.length) {
    parts.push(
      'Relevant NIST AI RMF playbook entries:\n' +
      nistSelected
        .map((c, i) => {
          const e = c.raw as NistEntry;
          return `${i + 1}. ${e.title} [${e.category}]\n${c.snippet}`;
        })
        .join('\n\n')
    );
  }

  // Phase 4: split GovSecure-tagged DB entries into their own labeled
  // section so the LLM (and the response.sources[] consumer) can attribute
  // them under the GovSecure Governance Library brand rather than the
  // generic "knowledge base entry" bucket.
  const dbSelected = byKind('db');
  const govsecureDbSelected = dbSelected.filter((c) => isGovSecureEntry(c.raw as DbEntry));
  const otherDbSelected = dbSelected.filter((c) => !isGovSecureEntry(c.raw as DbEntry));

  if (govsecureDbSelected.length) {
    parts.push(
      `${GOVSECURE_LIBRARY_LABEL} entries:\n` +
      govsecureDbSelected
        .map((c, i) => {
          const e = c.raw as DbEntry;
          const anchor = (e.tags ?? []).slice(0, 3).filter(Boolean).join(' · ');
          const provenance = anchor ? ` — ${anchor}` : '';
          return `${i + 1}. ${e.title}${provenance} [${e.category}]\n${c.snippet}`;
        })
        .join('\n\n'),
    );
  }

  if (otherDbSelected.length) {
    parts.push(
      'Additional knowledge base entries:\n' +
      otherDbSelected
        .map((c, i) => {
          const e = c.raw as DbEntry;
          return `${i + 1}. ${e.title} [${e.category}]\n${c.snippet}`;
        })
        .join('\n\n')
    );
  }

  if (sectorMatches.length) {
    parts.push(
      'Sector-specific AI governance guidance:\n' +
      sectorMatches
        .map((s, i) => {
          const topRegs = s.keyRegulations.slice(0, 3).map(r => `  - ${r.name}: ${r.relevance}`).join('\n');
          const topRisks = s.riskFactors.filter(r => r.severity === 'high').slice(0, 3).map(r => `  - ${r.factor}: ${r.description}`).join('\n');
          const topRecs = s.recommendations.slice(0, 3).map(r => `  - ${r}`).join('\n');
          return `${i + 1}. ${s.displayName}\nKey Regulations:\n${topRegs}\nHigh-Risk Factors:\n${topRisks}\nTop Recommendations:\n${topRecs}`;
        })
        .join('\n\n')
    );
  }

  if (regulationMatches.length) {
    parts.push(
      'Relevant emerging regulations:\n' +
      regulationMatches
        .map((r, i) => {
          const provisions = r.keyProvisions.slice(0, 3).map(p => `  - ${p.provision}: ${p.description}`).join('\n');
          const actions = r.complianceActions.slice(0, 3).map(a => `  - ${a}`).join('\n');
          return `${i + 1}. ${r.shortName} (${r.jurisdiction}, ${r.status})\n${createSnippet(r.summary)}\nKey Provisions:\n${provisions}\nCompliance Actions:\n${actions}`;
        })
        .join('\n\n')
    );
  }

  return {
    context: parts.length ? parts.join('\n\n') + '\n\nUse these details to ground your response and cite sources.' : null,
    documents: staticResult.documents,
    sources,
    sourcesStructured,
  };
}

export function buildKnowledgeContext(query: string, limit = 3): KnowledgeContextResult {
  const searchResult = knowledgeBase.search(query, undefined, limit);

  if (!searchResult.documents.length) {
    return { context: null, documents: [] };
  }

  const formatted = searchResult.documents
    .map((doc, index) => {
      return `${index + 1}. ${doc.title} (Source: ${doc.source}, Updated: ${doc.lastUpdated})\nSummary: ${createSnippet(doc.content)}`;
    })
    .join('\n\n');

  return {
    documents: searchResult.documents,
    context: `Relevant governance knowledge base documents:\n${formatted}\n\nUse these details to ground your response. Prioritize cited information and include the matching titles within the 'sources' field.`
  };
}