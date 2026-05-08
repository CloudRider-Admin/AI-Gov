/**
 * Semantic search over KnowledgeEntry using pgvector cosine similarity.
 *
 * Falls back to keyword-based search if:
 * - Embedding generation fails (API down)
 * - No embedded entries exist in the database
 * - Database query fails
 */

import { prisma } from '@/lib/prisma';
import { generateEmbedding } from './embeddings';
import { knowledgeBase, type KnowledgeDocument } from './knowledgeBase';

export interface SemanticSearchOptions {
  limit?: number;
  category?: string;
  /** Minimum similarity threshold (0-1). Default: 0.3 */
  threshold?: number;
  /** Filter by sourceType(s) */
  sourceTypes?: string[];
  /**
   * Phase 4: when truthy, GovSecure-tagged results get their similarity score
   * multiplied by `boostFactor` (default 1.25). Re-sorts after boosting.
   * Auto-detected from the query when not explicitly set — see
   * `shouldBoostGovSecure()`.
   */
  govsecureBoost?: boolean;
  /** Multiplier applied to GovSecure rows when `govsecureBoost` is on. Default 1.25. */
  boostFactor?: number;
}

/**
 * Returns true when the query mentions GovSecure-flagship terminology, in
 * which case GovSecure-tagged DB rows should outrank generic NIST/EU entries
 * even if those have slightly higher raw similarity. Exported for tests +
 * for callers that want to make the decision explicit.
 */
export function shouldBoostGovSecure(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\bgovsecure\b/.test(q) ||
    /\bai\s+chef\b/.test(q) ||
    /\b90.?day\b/.test(q) ||
    /\bpolicy\s+suite\b/.test(q) ||
    /\bblueprint\b/.test(q) ||
    /\btprm\b/.test(q)
  );
}

const DEFAULT_BOOST_FACTOR = 1.25;

interface VectorSearchRow {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: string | null;
  sourceType: string | null;
  similarity: number;
}

/**
 * Perform semantic search using pgvector cosine similarity.
 * Returns KnowledgeDocument[] ranked by semantic relevance.
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {},
): Promise<KnowledgeDocument[]> {
  const {
    limit = 5,
    category,
    threshold = 0.3,
    sourceTypes,
    govsecureBoost = shouldBoostGovSecure(query),
    boostFactor = DEFAULT_BOOST_FACTOR,
  } = options;

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // Build dynamic WHERE clause parts
    const conditions: string[] = [
      '"isActive" = true',
      'embedding IS NOT NULL',
    ];
    if (category) {
      conditions.push(`category = '${category.replace(/'/g, "''")}'`);
    }
    if (sourceTypes?.length) {
      const escaped = sourceTypes.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
      conditions.push(`"sourceType" IN (${escaped})`);
    }

    const whereClause = conditions.join(' AND ');

    // Cosine similarity query: 1 - cosine_distance
    const rows = await prisma.$queryRawUnsafe<VectorSearchRow[]>(
      `SELECT id, title, content, category, tags, source, "sourceType",
              1 - (embedding <=> $1::vector) AS similarity
       FROM "KnowledgeEntry"
       WHERE ${whereClause}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      limit,
    );

    // Phase 4: optionally boost GovSecure-tagged rows for queries that
    // mention GovSecure-flagship terminology, then re-sort and apply the
    // threshold against the boosted score.
    const boosted = rows.map((row: VectorSearchRow) => {
      const adjusted = govsecureBoost && row.sourceType === 'govsecure'
        ? Math.min(1, row.similarity * boostFactor)
        : row.similarity;
      return { row, adjusted };
    });

    boosted.sort((a, b) => b.adjusted - a.adjusted);

    return boosted
      .filter(({ adjusted }) => adjusted >= threshold)
      .slice(0, limit)
      .map(({ row, adjusted }) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category as KnowledgeDocument['category'],
        tags: row.tags ?? [],
        source: row.source ?? `Knowledge Base — ${row.title}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        relevanceScore: adjusted,
      }));
  } catch (error) {
    // Fallback to keyword search on any failure
    console.warn('[vectorSearch] Semantic search failed, falling back to keyword search:',
      error instanceof Error ? error.message : error);
    return fallbackKeywordSearch(query, limit, category);
  }
}

/**
 * Fallback keyword search using the existing KnowledgeBaseSearch.
 */
function fallbackKeywordSearch(
  query: string,
  limit: number,
  category?: string,
): KnowledgeDocument[] {
  const result = knowledgeBase.search(query, category, limit);
  return result.documents;
}

/**
 * Check if vector search is available (has embedded entries).
 */
export async function isVectorSearchAvailable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "KnowledgeEntry" WHERE embedding IS NOT NULL AND "isActive" = true`,
    );
    return Number(result[0]?.count ?? 0) > 0;
  } catch {
    return false;
  }
}