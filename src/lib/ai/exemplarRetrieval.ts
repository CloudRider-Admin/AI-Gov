/**
 * Few-shot exemplar retrieval — Phase 2.5.
 *
 * Selects the most representative real prose passages from the GovSecure
 * source documents and packages them so the `DocumentOrchestrator` can
 * embed them as a `REFERENCE EXEMPLARS` block. The single biggest quality
 * lever in the integration plan: without exemplars GPT-4o produces generic
 * policy text; with them it produces text that reads like GovSecure wrote it.
 *
 * Selection strategy (in priority order):
 *   1. Sections whose heading matches one of `sectionsToGenerate` (the user
 *      asked for that section, so the matching exemplar carries the most
 *      signal).
 *   2. Top-level (`level === 1`) sections — these are the canonical chapters
 *      and tend to contain the brand voice in its purest form.
 *   3. Sections with the most prose (paragraphs only, bullets discounted).
 *
 * Within those, sections are scored and the highest-scoring ones fill the
 * token budget (default 800 tokens, ≈ 3.2K characters).
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.5
 */

import { countTokens } from '@/lib/tokenBudget';
import {
  GOVSECURE_DOCUMENT_TEMPLATES,
  type GovSecureDocumentType,
} from '@/data/govsecurePolicies';
import { getDocumentByCode } from '@/data/govsecureKnowledge';
import type { DocumentType } from '@/types/documents';
import type { ExtractedSection } from '@/types/govsecure';

export interface Exemplar {
  documentType: DocumentType;
  sectionId: string;
  heading: string;
  /** Prose extracted from the source section, truncated to fit the budget. */
  prose: string;
  documentCode: string;
  /** Token count of `prose` (gpt-tokenizer cl100k). */
  tokenCount: number;
}

export interface ExemplarOptions {
  /** Hard cap on the number of exemplars returned. Default 2. */
  maxExemplars?: number;
  /** Soft cap on total tokens across all exemplars. Default 800. */
  targetTokens?: number;
}

const DEFAULT_MAX = 2;
const DEFAULT_TOKENS = 800;

/** Approximate cost of cutting prose to fit. 4 chars ≈ 1 token (cl100k). */
const CHARS_PER_TOKEN = 4;

const GOVSECURE_TYPE_SET: ReadonlySet<string> = new Set(
  Object.keys(GOVSECURE_DOCUMENT_TEMPLATES),
);

function isGovSecure(type: DocumentType): type is GovSecureDocumentType {
  return GOVSECURE_TYPE_SET.has(type);
}

/**
 * Get up to N representative GovSecure exemplars for a given document type.
 *
 * Returns `[]` for non-GovSecure document types (the generic governance docs
 * have no canonical exemplar source) — callers should treat that as "no
 * exemplar block" rather than an error.
 */
export function getExemplarsForGeneration(
  documentType: DocumentType,
  sectionsToGenerate: string[],
  options: ExemplarOptions = {},
): Exemplar[] {
  if (!isGovSecure(documentType)) return [];

  const maxExemplars = options.maxExemplars ?? DEFAULT_MAX;
  const targetTokens = options.targetTokens ?? DEFAULT_TOKENS;

  // Resolve the source document via the first template's documentCode.
  const templates = GOVSECURE_DOCUMENT_TEMPLATES[documentType];
  const sourceDocCode = templates[0]?.sourceDocCode;
  if (!sourceDocCode) return [];

  const doc = getDocumentByCode(sourceDocCode);
  if (!doc) return [];

  const wantedHeadings = new Set(
    sectionsToGenerate.map((s) => s.toLowerCase().trim()),
  );

  const candidates = doc.sections
    .filter((s) => proseOf(s).length > 0)
    .map((s) => ({ section: s, score: scoreSection(s, wantedHeadings) }))
    .sort((a, b) => b.score - a.score);

  const picked: Exemplar[] = [];
  let tokensUsed = 0;
  for (const { section } of candidates) {
    if (picked.length >= maxExemplars) break;
    const remaining = targetTokens - tokensUsed;
    if (remaining <= 50) break; // not enough room for a useful exemplar
    const prose = trimToTokens(proseOf(section), remaining);
    const tokenCount = countTokens(prose);
    if (tokenCount === 0) continue;
    picked.push({
      documentType,
      sectionId: section.id,
      heading: section.heading,
      prose,
      documentCode: doc.documentCode,
      tokenCount,
    });
    tokensUsed += tokenCount;
  }

  return picked;
}

/**
 * Render a `REFERENCE EXEMPLARS` block ready to drop into a system prompt.
 * Returns an empty string when no exemplars are available so callers can
 * always concatenate it unconditionally.
 */
export function renderExemplarBlock(exemplars: Exemplar[], docTitle: string): string {
  if (exemplars.length === 0) return '';
  const body = exemplars
    .map((e) => `### ${e.heading} (from ${e.documentCode} §${e.sectionId})\n${e.prose}`)
    .join('\n\n');
  return `REFERENCE EXEMPLARS — Real sections from the actual GovSecure ${docTitle}.
Match their tone, structure, density, and terminology in your output. Do NOT
copy them verbatim; they are voice anchors, not the answer.

${body}
`;
}

// ─── Internals ──────────────────────────────────────────────────────────────

function proseOf(s: ExtractedSection): string {
  // Bullets carry less brand voice than paragraphs, so we weight them out.
  return (s.paragraphs ?? []).filter((p) => p && p.trim().length > 0).join('\n\n').trim();
}

/**
 * Heuristic score: heading-match dominates, then level-1 priority, then
 * prose length. Numeric values picked so each tier strictly outranks the next.
 */
function scoreSection(s: ExtractedSection, wantedHeadings: Set<string>): number {
  const heading = s.heading.toLowerCase().trim();
  const proseLen = proseOf(s).length;

  let score = proseLen; // base: longest wins
  if (s.level === 1) score += 10_000; // level-1 chapters dominate length
  for (const wanted of wantedHeadings) {
    if (!wanted) continue;
    if (heading === wanted || heading.includes(wanted) || wanted.includes(heading)) {
      score += 1_000_000; // exact/substring match dominates everything
      break;
    }
  }
  return score;
}

function trimToTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return '';
  // Fast path: short strings rarely exceed the budget — only count tokens
  // when the cheap char heuristic suggests we're over.
  if (text.length <= maxTokens * CHARS_PER_TOKEN) {
    return text;
  }
  // Trim by characters first to a generous bound, then verify with the real
  // tokenizer and shrink if still over.
  let trimmed = text.slice(0, maxTokens * CHARS_PER_TOKEN);
  while (countTokens(trimmed) > maxTokens && trimmed.length > 100) {
    trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.9));
  }
  return `${trimmed.replace(/\s+\S*$/, '')}…`;
}
