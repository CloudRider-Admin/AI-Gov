/**
 * Slug normalisation and lookup for regulation cards.
 *
 * The advisor LLM emits free-form `regulation` and `article` strings
 * (e.g. "GDPR" / "Article 5", "EU AI Act" / "Annex III §5"). This module
 * maps those to a canonical `regulationSlug/articleSlug` URL segment so
 * we can:
 *   1. look up curated content in `REGULATION_LIBRARY_BY_SLUG`, and
 *   2. build stable URLs for `/govi/regulations/[reg]/[article]`.
 *
 * Both directions are supported: `toSlugs()` for cards → URL, and
 * `fromSlugs()` for URL → display strings (used by the standalone reader
 * page when no curated entry exists and we still want to render a heading).
 */

import {
  REGULATION_LIBRARY_BY_SLUG,
  type RegulationEntry,
} from '@/data/regulationLibrary';

const REGULATION_ALIASES: Record<string, string> = {
  // GDPR
  'gdpr': 'gdpr',
  'general data protection regulation': 'gdpr',
  // EU AI Act
  'eu ai act': 'eu-ai-act',
  'eu-ai-act': 'eu-ai-act',
  'ai act': 'eu-ai-act',
  'aia': 'eu-ai-act',
  'regulation eu 2024 1689': 'eu-ai-act',
  'regulation (eu) 2024/1689': 'eu-ai-act',
  // NIST AI RMF
  'nist ai rmf': 'nist-ai-rmf',
  'nist-ai-rmf': 'nist-ai-rmf',
  'nist': 'nist-ai-rmf',
  'ai rmf': 'nist-ai-rmf',
  // ISO 42001
  'iso 42001': 'iso-42001',
  'iso/iec 42001': 'iso-42001',
  'iso iec 42001': 'iso-42001',
  // Common US frameworks (no curated entries yet but slugs are stable)
  'ccpa': 'ccpa',
  'california consumer privacy act': 'ccpa',
  'hipaa': 'hipaa',
  'fcra': 'fcra',
  'glba': 'glba',
};

const ROMAN = /\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/g;

/**
 * Lowercase, strip punctuation, collapse whitespace, and replace
 * common section symbols with words. Returns a URL-safe slug.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[§]/g, ' section ')
    .replace(/[•·]/g, ' ')
    .replace(/[^\w\s./-]/g, ' ')
    .replace(/[/.]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toRegulationSlug(regulation: string): string {
  const key = regulation
    .toLowerCase()
    .replace(/[^\w\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return REGULATION_ALIASES[key] ?? slugify(regulation);
}

export function toArticleSlug(article: string): string {
  // Normalise common prefixes/formatting before slugifying.
  // "Article 5"          → "article-5"
  // "Art. 5"             → "article-5"
  // "Annex III §5"       → "annex-iii-5"
  // "Annex III, §5(a)"   → "annex-iii-5-a"
  // "GOVERN 1.1"         → "govern-1-1"
  // "§22"                → "article-22"  (when standalone)
  const cleaned = article
    .replace(/^art\.\s*/i, 'article ')
    .replace(/^§\s*/, 'article ')
    .replace(/section\s*/gi, ' ')
    .replace(/,/g, ' ');
  return slugify(cleaned);
}

export function toSlugs(regulation: string, article: string): {
  regulationSlug: string;
  articleSlug: string;
  fullSlug: string;
} {
  const regulationSlug = toRegulationSlug(regulation);
  const articleSlug = toArticleSlug(article);
  return {
    regulationSlug,
    articleSlug,
    fullSlug: `${regulationSlug}/${articleSlug}`,
  };
}

/**
 * Look up a curated regulation entry. Returns `null` if no curated entry
 * exists for this slug — callers should fall back to LLM generation.
 */
export function getRegulationEntry(
  regulation: string,
  article: string,
): RegulationEntry | null {
  const { fullSlug } = toSlugs(regulation, article);
  return REGULATION_LIBRARY_BY_SLUG.get(fullSlug) ?? null;
}

export function getRegulationEntryBySlug(
  regulationSlug: string,
  articleSlug: string,
): RegulationEntry | null {
  return REGULATION_LIBRARY_BY_SLUG.get(`${regulationSlug}/${articleSlug}`) ?? null;
}

/**
 * Best-effort reverse mapping for URL → display labels. Used by the
 * standalone reader page when the slug doesn't match a curated entry
 * so we can still render a meaningful heading.
 */
export function fromSlugs(regulationSlug: string, articleSlug: string): {
  regulation: string;
  article: string;
} {
  const regDisplay = (() => {
    switch (regulationSlug) {
      case 'gdpr':
        return 'GDPR';
      case 'eu-ai-act':
        return 'EU AI Act';
      case 'nist-ai-rmf':
        return 'NIST AI RMF';
      case 'iso-42001':
        return 'ISO 42001';
      case 'ccpa':
        return 'CCPA';
      case 'hipaa':
        return 'HIPAA';
      case 'fcra':
        return 'FCRA';
      case 'glba':
        return 'GLBA';
      default:
        return regulationSlug.toUpperCase();
    }
  })();

  const article = articleSlug
    .replace(/^article-/, 'Article ')
    .replace(/^annex-/, 'Annex ')
    .replace(/^govern[-]?/, 'GOVERN ')
    .replace(/^map[-]?/, 'MAP ')
    .replace(/^measure[-]?/, 'MEASURE ')
    .replace(/^manage[-]?/, 'MANAGE ')
    .replace(ROMAN, (m) => m.toUpperCase())
    .replace(/-/g, ' ')
    .trim();

  return { regulation: regDisplay, article };
}
