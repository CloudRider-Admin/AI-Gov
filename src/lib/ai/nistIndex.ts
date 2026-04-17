/**
 * Pre-indexed NIST AI RMF Playbook for fast keyword lookup.
 *
 * Instead of scanning all 72 entries on every request, we build an inverted
 * index at module load time. Lookups are O(queryTerms) instead of O(entries × queryTerms).
 */

import nistPlaybookData from '@/data/nistPlaybook.json';

export interface NistEntry {
  type: string;
  title: string;
  category: string;
  description: string;
  section_about?: string;
  section_actions?: string;
  section_doc?: string;
  section_ref?: string;
}

interface IndexEntry {
  /** Index into the entries array */
  idx: number;
  /** Weight: title terms score higher */
  weight: number;
}

const entries: NistEntry[] = nistPlaybookData as NistEntry[];

// ── Build inverted index: term → [{ entryIndex, weight }] ──
// Title/category terms get weight 3, description terms get weight 1,
// section_about terms get weight 1.
const invertedIndex = new Map<string, IndexEntry[]>();

function indexTerm(term: string, idx: number, weight: number) {
  if (term.length <= 2) return;
  const existing = invertedIndex.get(term);
  if (existing) {
    // Merge: if this entry already indexed for this term, add weight
    const found = existing.find(e => e.idx === idx);
    if (found) {
      found.weight += weight;
    } else {
      existing.push({ idx, weight });
    }
  } else {
    invertedIndex.set(term, [{ idx, weight }]);
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

// Build index at module load (runs once on cold start, ~2ms for 72 entries)
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  for (const t of tokenize(`${e.title} ${e.category}`)) indexTerm(t, i, 3);
  for (const t of tokenize(e.description)) indexTerm(t, i, 1);
  if (e.section_about) {
    for (const t of tokenize(e.section_about)) indexTerm(t, i, 1);
  }
}

/**
 * Search the NIST playbook using the pre-built inverted index.
 * Returns top `limit` entries sorted by relevance score.
 */
export function searchNistPlaybook(query: string, limit = 3): NistEntry[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  // Accumulate scores per entry
  const scores = new Map<number, number>();

  for (const term of queryTerms) {
    const hits = invertedIndex.get(term);
    if (!hits) continue;
    for (const { idx, weight } of hits) {
      scores.set(idx, (scores.get(idx) ?? 0) + weight);
    }
  }

  if (scores.size === 0) return [];

  // Sort by score descending, take top `limit`
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([idx]) => entries[idx]);
}

/** Total number of indexed entries (for diagnostics) */
export const NIST_ENTRY_COUNT = entries.length;
/** Total number of indexed terms (for diagnostics) */
export const NIST_TERM_COUNT = invertedIndex.size;
