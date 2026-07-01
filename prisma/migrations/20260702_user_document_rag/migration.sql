-- RAG over the user's own uploaded documents (Tier 3).

CREATE TABLE "UserDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "framework" TEXT,
  "charCount" INTEGER NOT NULL DEFAULT 0,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserDocument_userId_createdAt_idx" ON "UserDocument"("userId", "createdAt");

CREATE TABLE "UserDocumentChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1536),
  "embeddedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDocumentChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserDocumentChunk_userId_idx" ON "UserDocumentChunk"("userId");
CREATE INDEX "UserDocumentChunk_documentId_idx" ON "UserDocumentChunk"("documentId");
ALTER TABLE "UserDocumentChunk"
  ADD CONSTRAINT "UserDocumentChunk_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "UserDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- IVFFlat index for cosine similarity. Effective once enough rows exist; exact
-- search is used transparently until then.
CREATE INDEX "UserDocumentChunk_embedding_idx" ON "UserDocumentChunk"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
