/**
 * Eval Harness — deterministic rubric
 *
 * Pure functions used by the runner to score generated output against a
 * golden case without calling an LLM. The judged score (voice match) lives
 * in `judge.ts` and is optional.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.5.2
 */

import { unverifiedCitations, validateCitations } from '@/lib/ai/citationValidator';
import type {
  CaseScore,
  DeterministicScore,
  GoldenCase,
  JudgedScore,
} from './types';

export const RUBRIC_VERSION = '1.2.0';

/** Score weights — must sum to 1.0. */
export const SCORE_WEIGHTS = {
  structureMatch: 0.3,
  requiredClausesPresent: 0.3,
  voiceMatch: 0.3,
  hallucinationCheck: 0.1,
} as const;

/** Pass threshold on the overall weighted score. */
export const PASS_THRESHOLD = 0.8;

/**
 * Naive citation regex used by `looksLikeFabricatedCitation`. Catches:
 *   - "Article 99" / "Article 99(2)" — far above any real EU AI Act / GDPR article.
 *   - "Recital 200+" — far above any real recital.
 *   - "GOVERN-99" / "MAP-99" / "MEASURE-99" / "MANAGE-99" — beyond plausible NIST IDs.
 *   - "ISO 42001 Clause 99" — beyond Clause 10.
 *
 * False positives are acceptable for an eval gate; we surface them as candidate
 * hallucinations and let the judge or human review confirm.
 */
const SUSPICIOUS_CITATION_PATTERNS: RegExp[] = [
  /\bArticle\s+(\d{2,})/gi,
  /\bRecital\s+(\d{3,})/gi,
  /\b(GOVERN|MAP|MEASURE|MANAGE)-(\d{2,})\b/gi,
  /\bISO\/?IEC?\s*42001[^.\n]{0,40}Clause\s+(1[1-9]|[2-9]\d)\b/gi,
];

interface SuspiciousMatch {
  pattern: string;
  match: string;
  number: number;
}

/**
 * Find citations whose numeric component is implausibly high. Used as a
 * conservative hallucination tripwire — does not catch every fabrication
 * but catches the most egregious "Article 47", "GOVERN-12" style errors.
 */
export function findSuspiciousCitations(text: string): SuspiciousMatch[] {
  const hits: SuspiciousMatch[] = [];
  for (const pattern of SUSPICIOUS_CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const num = Number(match[match.length - 1]);
      if (Number.isNaN(num)) continue;
      let threshold = 99;
      if (pattern.source.includes('Article')) threshold = 99;
      else if (pattern.source.includes('Recital')) threshold = 200;
      else if (pattern.source.includes('GOVERN|MAP|MEASURE|MANAGE')) threshold = 10;
      else if (pattern.source.includes('Clause')) threshold = 10;
      if (num > threshold) {
        hits.push({ pattern: pattern.source, match: match[0], number: num });
      }
    }
  }
  return hits;
}

/** Case-insensitive substring presence. */
function includesCi(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Word-boundary-aware presence check for forbidden terms.
 *
 * Plain substring matching produces false positives: forbidden `"Low"` would
 * match inside `"allow"`, `"below"`, `"follow"`, and `"workflow"`, failing
 * otherwise-correct High/Critical assessments. We require the forbidden term
 * to be bounded by non-alphanumeric characters so `"Low"` matches the tier
 * word and `"Low-Risk"` but not `"allow"`. Multi-word phrases ("Conditional
 * Go") and citation patterns ("Article 99") are matched verbatim with the
 * same boundaries. (Rubric v1.2.0 correctness fix.)
 */
function containsForbidden(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(haystack);
}

/**
 * Score the deterministic rubric components against generated text.
 *
 * @param generatedText — the rendered output (markdown, prose, etc.).
 * @param expectedSections — heading-level fragments that should appear as section headers.
 * @param requiredClauses — substrings that must appear somewhere in the output.
 * @param forbiddenContent — substrings that must NOT appear.
 */
export function scoreDeterministic(
  generatedText: string,
  opts: {
    expectedSections?: string[];
    requiredClauses: string[];
    forbiddenContent: string[];
  },
): DeterministicScore {
  const { expectedSections = [], requiredClauses, forbiddenContent } = opts;
  const text = generatedText ?? '';

  const sectionsFound = expectedSections.filter((s) => includesCi(text, s));
  const structureMatch =
    expectedSections.length === 0 ? 1 : sectionsFound.length / expectedSections.length;

  const clausesFound = requiredClauses.filter((c) => includesCi(text, c));
  const missingClauses = requiredClauses.filter((c) => !includesCi(text, c));
  const requiredClausesPresent =
    requiredClauses.length === 0 ? 1 : clausesFound.length / requiredClauses.length;

  const forbiddenHits = forbiddenContent.filter((c) => containsForbidden(text, c));
  const suspicious = findSuspiciousCitations(text);
  // Phase 1.6: hard gate on the structured citation validator. Anything the
  // regex tripwire missed but the validator catches still fails the case.
  const unverified = unverifiedCitations(validateCitations(text));
  const hallucinationCheck: 'pass' | 'fail' =
    forbiddenHits.length === 0 && suspicious.length === 0 && unverified.length === 0
      ? 'pass'
      : 'fail';

  const combinedForbidden = [
    ...forbiddenHits,
    ...suspicious.map((s) => `suspicious-citation:${s.match}`),
    ...unverified.map((u) => `unverified-citation:${u.cited}`),
  ];

  return {
    structureMatch: round3(structureMatch),
    requiredClausesPresent: round3(requiredClausesPresent),
    hallucinationCheck,
    missingClauses,
    forbiddenHits: combinedForbidden,
    unverifiedCitationCount: unverified.length,
    unverifiedCitationSamples: unverified.slice(0, 5).map((u) => u.cited),
  };
}

/** Combine deterministic + judged scores into a single weighted overall. */
export function computeOverall(
  det: DeterministicScore,
  judged: JudgedScore,
): number {
  const voice = judged.voiceMatch ?? det.requiredClausesPresent; // sensible fallback when no exemplar
  const halluc = det.hallucinationCheck === 'pass' ? 1 : 0;
  const overall =
    SCORE_WEIGHTS.structureMatch * det.structureMatch +
    SCORE_WEIGHTS.requiredClausesPresent * det.requiredClausesPresent +
    SCORE_WEIGHTS.voiceMatch * voice +
    SCORE_WEIGHTS.hallucinationCheck * halluc;
  return round3(overall);
}

/** Build the final per-case score from its parts. */
export function buildCaseScore(
  goldenCase: GoldenCase,
  det: DeterministicScore,
  judged: JudgedScore,
  durationMs: number,
  error?: string,
): CaseScore {
  const overall = computeOverall(det, judged);
  return {
    caseId: goldenCase.id,
    category: goldenCase.category,
    deterministic: det,
    judged,
    overall,
    passed: overall >= PASS_THRESHOLD && det.hallucinationCheck === 'pass' && !error,
    error,
    durationMs,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
