-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new columns to KnowledgeEntry
ALTER TABLE "KnowledgeEntry" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "KnowledgeEntry" ADD COLUMN IF NOT EXISTS "sourceType" TEXT DEFAULT 'manual';
ALTER TABLE "KnowledgeEntry" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "KnowledgeEntry" ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP;

-- Create index on sourceType for filtering
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_sourceType_idx" ON "KnowledgeEntry" ("sourceType");

-- Create IVFFlat index for cosine similarity search on embeddings
-- Note: IVFFlat requires at least 100 rows to be effective; HNSW is an alternative
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_embedding_idx" ON "KnowledgeEntry"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  