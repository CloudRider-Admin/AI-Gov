import { prisma } from './prisma';
import { generateEmbeddings, generateEmbedding } from './ai/embeddings';

const CHUNK_TARGET_CHARS = 1200;
const MAX_CHUNKS = 40; // cap embedding cost per document

/** Split text into ~CHUNK_TARGET_CHARS chunks on paragraph boundaries. */
export function chunkText(text: string): string[] {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > CHUNK_TARGET_CHARS) {
      chunks.push(current);
      current = '';
    }
    // A single oversized paragraph is hard-split.
    if (para.length > CHUNK_TARGET_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < para.length; i += CHUNK_TARGET_CHARS) {
        chunks.push(para.slice(i, i + CHUNK_TARGET_CHARS));
      }
      continue;
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current) chunks.push(current);
  return chunks.slice(0, MAX_CHUNKS);
}

/**
 * Persist an uploaded document and embed its chunks so the advisor can retrieve
 * it (RAG). Best-effort on embeddings: the document row is always created, and
 * chunks that fail to embed are skipped rather than aborting the upload.
 */
export async function ingestUserDocument(params: {
  userId: string;
  fileName: string;
  text: string;
  framework?: string | null;
}): Promise<{ documentId: string; chunkCount: number }> {
  const chunks = chunkText(params.text);

  const doc = await prisma.userDocument.create({
    data: {
      userId: params.userId,
      fileName: params.fileName,
      framework: params.framework ?? null,
      charCount: params.text.length,
      chunkCount: chunks.length,
    },
  });

  if (chunks.length === 0) return { documentId: doc.id, chunkCount: 0 };

  let embeddings: number[][] = [];
  try {
    embeddings = await generateEmbeddings(chunks);
  } catch (err) {
    console.error('[userDocuments] Embedding failed; storing without vectors:', err);
  }

  let stored = 0;
  for (let i = 0; i < chunks.length; i++) {
    const id = `${doc.id}-c${i}`;
    const vector = embeddings[i];
    try {
      if (vector) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "UserDocumentChunk" ("id","documentId","userId","chunkIndex","content","embedding","embeddedAt","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6::vector,NOW(),NOW())`,
          id,
          doc.id,
          params.userId,
          i,
          chunks[i],
          `[${vector.join(',')}]`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "UserDocumentChunk" ("id","documentId","userId","chunkIndex","content","createdAt")
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          id,
          doc.id,
          params.userId,
          i,
          chunks[i],
        );
      }
      stored++;
    } catch (err) {
      console.error('[userDocuments] Failed to store chunk', i, err);
    }
  }

  return { documentId: doc.id, chunkCount: stored };
}

export interface UserDocMatch {
  id: string;
  content: string;
  fileName: string;
  similarity: number;
}

/** Cosine-similarity search over a single user's document chunks. */
export async function searchUserDocuments(
  userId: string,
  query: string,
  limit = 4,
): Promise<UserDocMatch[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const rows = await prisma.$queryRawUnsafe<
      { id: string; content: string; fileName: string; similarity: number }[]
    >(
      `SELECT c.id, c.content, d."fileName" AS "fileName",
              1 - (c.embedding <=> $1::vector) AS similarity
       FROM "UserDocumentChunk" c
       JOIN "UserDocument" d ON d.id = c."documentId"
       WHERE c."userId" = $2 AND c.embedding IS NOT NULL
       ORDER BY c.embedding <=> $1::vector
       LIMIT $3`,
      vectorStr,
      userId,
      limit,
    );
    return rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
  } catch (err) {
    console.warn('[userDocuments] Search failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function listUserDocuments(userId: string) {
  return prisma.userDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, framework: true, charCount: true, chunkCount: true, createdAt: true },
  });
}

export async function deleteUserDocument(userId: string, id: string) {
  const doc = await prisma.userDocument.findFirst({ where: { id, userId }, select: { id: true } });
  if (!doc) return false;
  await prisma.userDocument.delete({ where: { id } }); // chunks cascade
  return true;
}

/** Whether the user has any embedded document chunks (gate RAG retrieval). */
export async function hasUserDocuments(userId: string): Promise<boolean> {
  const count = await prisma.userDocumentChunk.count({ where: { userId } });
  return count > 0;
}
