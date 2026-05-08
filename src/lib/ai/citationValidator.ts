/**
 * Citation validator — Phase 1.6 hallucination guardrail.
 *
 * Extracts every candidate regulation/control/clause/template citation from
 * Govi's response text and verifies it against the seed corpus. Anything we
 * can't ground is reported as `verified: false` so the calling route can log,
 * strip, or warn.
 *
 * Coverage at v1:
 *   - NIST AI RMF subcategories     (GOVERN/MAP/MEASURE/MANAGE N(.M))
 *   - EU AI Act articles            (1–113)            — whitelist of valid range
 *   - EU AI Act recitals            (1–180)            — whitelist of valid range
 *   - GDPR articles                 (1–99)             — full valid range
 *   - ISO/IEC 42001 clauses         (1–10) + Annex A
 *   - GovSecure template references (from the content manifest)
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.6
 */

import nistPlaybookData from '@/data/nistPlaybook.json';
import { GOVSECURE_NIST_RCM, getManifestEntries } from '@/data/govsecureKnowledge';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CitationType =
  | 'nist-control'
  | 'eu-ai-act-article'
  | 'eu-ai-act-recital'
  | 'gdpr-article'
  | 'iso-clause'
  | 'govsecure-template';

export interface CitationCheck {
  /** The exact text that was matched (e.g. "Article 22 of GDPR"). */
  cited: string;
  /** Normalized canonical form used for lookup (e.g. "GDPR Article 22"). */
  canonical: string;
  /** Citation kind. */
  type: CitationType;
  /** Whether the citation grounds in the seed corpus. */
  verified: boolean;
  /** Where the citation was found, when verified. */
  source?: string;
  /** Why a citation failed verification — useful for logging. */
  reason?: string;
}

// ─── Canonical registries ───────────────────────────────────────────────────

interface NistEntry {
  type?: string;
  title?: string;
  category?: string;
}

/** Known NIST AI RMF subcategory IDs in their canonical "GOVERN 1.1" form. */
const KNOWN_NIST_IDS: Set<string> = (() => {
  const set = new Set<string>();
  for (const entry of nistPlaybookData as NistEntry[]) {
    if (entry.title && /^(GOVERN|MAP|MEASURE|MANAGE)\s+\d+(\.\d+)?$/.test(entry.title)) {
      set.add(entry.title.toUpperCase());
    }
    if (entry.category && /^(GOVERN|MAP|MEASURE|MANAGE)-\d+$/.test(entry.category)) {
      // category is e.g. "GOVERN-1" — also store the space form for symmetry
      set.add(entry.category.replace('-', ' ').toUpperCase());
    }
  }
  // Pull anything from the GovSecure NIST RCM too — controlId column.
  for (const ctrl of GOVSECURE_NIST_RCM) {
    if (ctrl.controlId && /^(GOVERN|MAP|MEASURE|MANAGE)[\s-]\d+(\.\d+)?$/i.test(ctrl.controlId)) {
      set.add(ctrl.controlId.replace(/-/g, ' ').toUpperCase());
    }
  }
  return set;
})();

/**
 * EU AI Act has 113 articles. The validator accepts 1–113 as plausible; this
 * is wide enough to allow any genuine citation while still rejecting the
 * "Article 250" / "Article 999" hallucinations we see in practice.
 */
const EU_AI_ACT_ARTICLE_MAX = 113;
/** EU AI Act has 180 recitals. */
const EU_AI_ACT_RECITAL_MAX = 180;
/** GDPR has 99 articles. */
const GDPR_ARTICLE_MAX = 99;
/** ISO/IEC 42001:2023 has 10 main clauses (plus Annexes). */
const ISO_42001_CLAUSE_MAX = 10;

const ISO_42001_ANNEXES = new Set(['A', 'B', 'C', 'D']);

/**
 * Default GovSecure template registry — every `documentCode` from the
 * bundled manifest. Built once at module load so lookups are O(1) and the
 * default behavior is "reject unless known", not "accept everything".
 *
 * Callers can still pass an explicit `govsecureTemplates` set in
 * `ValidateOptions` to override the default (e.g. tests, future tenants
 * with private templates).
 */
const DEFAULT_GOVSECURE_TEMPLATES: Set<string> = (() => {
  const set = new Set<string>();
  for (const entry of getManifestEntries()) {
    if (entry.documentCode) set.add(entry.documentCode);
  }
  return set;
})();

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ValidateOptions {
  /** Optional override for known GovSecure template references. */
  govsecureTemplates?: Set<string>;
}

/**
 * Extract and verify every citation in `responseText`. Pure: no I/O.
 *
 * Returns one entry per distinct citation occurrence (deduplicated by
 * canonical form so a citation cited 3× isn't reported 3×).
 */
export function validateCitations(
  responseText: string,
  opts: ValidateOptions = {},
): CitationCheck[] {
  if (!responseText) return [];

  const checks: CitationCheck[] = [];
  const seen = new Set<string>();

  for (const c of extractCitations(responseText, opts)) {
    if (seen.has(c.canonical)) continue;
    seen.add(c.canonical);
    checks.push(c);
  }
  return checks;
}

/** Convenience accessor used by routes / rubric. */
export function unverifiedCitations(checks: CitationCheck[]): CitationCheck[] {
  return checks.filter((c) => !c.verified);
}

/**
 * Remove unverified citations from `text`. Replaces each occurrence with the
 * citation's `type` in brackets so the prose stays grammatical.
 */
export function stripCitations(text: string, unverified: CitationCheck[]): string {
  let out = text;
  for (const c of unverified) {
    // Escape regex metacharacters in the literal cited string.
    const safe = c.cited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(safe, 'g'), `[${c.type}: unverified]`);
  }
  return out;
}

/**
 * Walk every string field of an arbitrary JSON-serializable value, returning
 * the concatenation of all string content. Used to validate citations across
 * the whole AdvisorResponse (riskProfile.description, regulationCheck[]…)
 * without coupling the validator to the schema.
 */
export function flattenStrings(value: unknown): string {
  const buf: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      buf.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (v && typeof v === 'object') {
      for (const item of Object.values(v as Record<string, unknown>)) walk(item);
    }
  };
  walk(value);
  return buf.join('\n');
}

/**
 * Threshold above which the route strips unverified citations from the
 * response. Below it, we log but otherwise let the response through (a single
 * stray citation is more often a false positive than a real fabrication).
 */
export const STRIP_THRESHOLD = 2;

// ─── Extraction ─────────────────────────────────────────────────────────────

type ExtractedCitation = CitationCheck;

function* extractCitations(
  text: string,
  opts: ValidateOptions,
): Generator<ExtractedCitation> {
  yield* extractNistControls(text);
  yield* extractEuAiActArticles(text);
  yield* extractEuAiActRecitals(text);
  yield* extractGdprArticles(text);
  yield* extractIsoClauses(text);
  yield* extractGovSecureTemplates(text, opts.govsecureTemplates);
}

// ── NIST ──
const NIST_RE = /\b(GOVERN|MAP|MEASURE|MANAGE)[\s-](\d+)(?:\.(\d+))?\b/gi;

function* extractNistControls(text: string): Generator<ExtractedCitation> {
  for (const m of text.matchAll(NIST_RE)) {
    const family = m[1].toUpperCase();
    const major = m[2];
    const minor = m[3];
    const canonical = minor ? `${family} ${major}.${minor}` : `${family} ${major}`;
    const verified = KNOWN_NIST_IDS.has(canonical);
    yield {
      cited: m[0],
      canonical,
      type: 'nist-control',
      verified,
      source: verified ? 'NIST AI RMF Playbook' : undefined,
      reason: verified ? undefined : 'not in NIST AI RMF subcategory registry',
    };
  }
}

// ── EU AI Act articles ──
const EU_AI_ACT_ARTICLE_RE =
  /\bArticle\s+(\d{1,3})(?:\(\d+\))?\s+(?:of\s+)?(?:the\s+)?EU\s+AI\s+Act\b|\bEU\s+AI\s+Act\s+Article\s+(\d{1,3})\b/gi;

function* extractEuAiActArticles(text: string): Generator<ExtractedCitation> {
  for (const m of text.matchAll(EU_AI_ACT_ARTICLE_RE)) {
    const num = Number(m[1] ?? m[2]);
    const canonical = `EU AI Act Article ${num}`;
    const verified = num >= 1 && num <= EU_AI_ACT_ARTICLE_MAX;
    yield {
      cited: m[0],
      canonical,
      type: 'eu-ai-act-article',
      verified,
      source: verified ? 'EU AI Act 2024/1689' : undefined,
      reason: verified ? undefined : `article ${num} outside valid range 1–${EU_AI_ACT_ARTICLE_MAX}`,
    };
  }
}

// ── EU AI Act recitals ──
const EU_AI_ACT_RECITAL_RE =
  /\bRecital\s+(\d{1,3})\s+(?:of\s+)?(?:the\s+)?EU\s+AI\s+Act\b|\bEU\s+AI\s+Act\s+Recital\s+(\d{1,3})\b/gi;

function* extractEuAiActRecitals(text: string): Generator<ExtractedCitation> {
  for (const m of text.matchAll(EU_AI_ACT_RECITAL_RE)) {
    const num = Number(m[1] ?? m[2]);
    const canonical = `EU AI Act Recital ${num}`;
    const verified = num >= 1 && num <= EU_AI_ACT_RECITAL_MAX;
    yield {
      cited: m[0],
      canonical,
      type: 'eu-ai-act-recital',
      verified,
      source: verified ? 'EU AI Act 2024/1689' : undefined,
      reason: verified ? undefined : `recital ${num} outside valid range 1–${EU_AI_ACT_RECITAL_MAX}`,
    };
  }
}

// ── GDPR articles ──
const GDPR_ARTICLE_RE =
  /\bGDPR\s+Article\s+(\d{1,3})\b|\bArticle\s+(\d{1,3})(?:\(\d+\))?\s+(?:of\s+)?GDPR\b/gi;

function* extractGdprArticles(text: string): Generator<ExtractedCitation> {
  for (const m of text.matchAll(GDPR_ARTICLE_RE)) {
    const num = Number(m[1] ?? m[2]);
    const canonical = `GDPR Article ${num}`;
    const verified = num >= 1 && num <= GDPR_ARTICLE_MAX;
    yield {
      cited: m[0],
      canonical,
      type: 'gdpr-article',
      verified,
      source: verified ? 'GDPR (Regulation (EU) 2016/679)' : undefined,
      reason: verified ? undefined : `article ${num} outside valid range 1–${GDPR_ARTICLE_MAX}`,
    };
  }
}

// ── ISO/IEC 42001 clauses ──
const ISO_CLAUSE_RE =
  /\bISO\/?IEC?\s*42001(?::\s*\d{4})?\s*(?:[-—]\s*)?Clause\s+(\d{1,2})(?:\.\d+)?\b|\bClause\s+(\d{1,2})(?:\.\d+)?\s+of\s+ISO\/?IEC?\s*42001\b/gi;
const ISO_ANNEX_RE = /\bISO\/?IEC?\s*42001\s*(?:[-—]\s*)?Annex\s+([A-D])\b/gi;

function* extractIsoClauses(text: string): Generator<ExtractedCitation> {
  for (const m of text.matchAll(ISO_CLAUSE_RE)) {
    const num = Number(m[1] ?? m[2]);
    const canonical = `ISO/IEC 42001 Clause ${num}`;
    const verified = num >= 1 && num <= ISO_42001_CLAUSE_MAX;
    yield {
      cited: m[0],
      canonical,
      type: 'iso-clause',
      verified,
      source: verified ? 'ISO/IEC 42001:2023' : undefined,
      reason: verified ? undefined : `clause ${num} outside valid range 1–${ISO_42001_CLAUSE_MAX}`,
    };
  }
  for (const m of text.matchAll(ISO_ANNEX_RE)) {
    const annex = m[1].toUpperCase();
    const canonical = `ISO/IEC 42001 Annex ${annex}`;
    const verified = ISO_42001_ANNEXES.has(annex);
    yield {
      cited: m[0],
      canonical,
      type: 'iso-clause',
      verified,
      source: verified ? 'ISO/IEC 42001:2023' : undefined,
      reason: verified ? undefined : `annex ${annex} not in registry`,
    };
  }
}

// ── GovSecure templates ──
const GOVSECURE_TEMPLATE_RE = /\bGS-[A-Z]{2,5}-[A-Z0-9]+-\d{2}\b/g;

function* extractGovSecureTemplates(
  text: string,
  knownTemplates?: Set<string>,
): Generator<ExtractedCitation> {
  const registry = knownTemplates ?? DEFAULT_GOVSECURE_TEMPLATES;
  for (const m of text.matchAll(GOVSECURE_TEMPLATE_RE)) {
    const code = m[0];
    const verified = registry.has(code);
    yield {
      cited: code,
      canonical: code,
      type: 'govsecure-template',
      verified,
      source: verified ? 'GovSecure template manifest' : undefined,
      reason: verified ? undefined : 'template code not in manifest',
    };
  }
}
