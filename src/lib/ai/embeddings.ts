/**
 * OpenAI embedding generation utility.
 *
 * Uses `text-embedding-3-small` (1536 dimensions) for vector search.
 * Includes retry logic and content truncation for long documents.
 */

import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_TOKENS = 8000; // Model limit is 8191; leave margin

/**
 * Rough token estimate for truncation (1 token ≈ 4 chars for English text).
 */
function truncateForEmbedding(text: string): string {
  const maxChars = MAX_TOKENS * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  return new OpenAI({ apiKey });
}

/**
 * Generate a single embedding vector for the given text.
 * Returns a 1536-dimensional float array.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const input = truncateForEmbedding(text.replace(/\n+/g, ' ').trim());

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * OpenAI supports batch embedding — more efficient than individual calls.
 * Batches are capped at 20 items to stay within rate limits.
 */
export async function generateEmbeddings(
  texts: string[],
  batchSize = 20,
): Promise<number[][]> {
  const openai = getOpenAIClient();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) =>
      truncateForEmbedding(t.replace(/\n+/g, ' ').trim()),
    );

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    // Sort by index to preserve order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sorted.map((d) => d.embedding));
  }

  return allEmbeddings;
}

/**
 * Build a combined text representation of a knowledge entry for embedding.
 * Weights the title by repeating it for better semantic matching.
 */
export function buildEmbeddingText(title: string, content: string, tags: string[] = []): string {
  const tagStr = tags.length ? `Tags: ${tags.join(', ')}` : '';
  // Repeat title for higher weight in embedding space
  return `${title}\n${title}\n${tagStr}\n${content}`;
}