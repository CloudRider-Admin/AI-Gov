-- Add artifactType to Message
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "artifactType" TEXT;

-- Create AnalyticsEvent table
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes for AnalyticsEvent
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_event_createdAt_idx" ON "AnalyticsEvent"("event", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_category_createdAt_idx" ON "AnalyticsEvent"("category", "createdAt");

-- Full-text search index on Message.content for conversation search
-- Using GIN index with to_tsvector for efficient text search
CREATE INDEX IF NOT EXISTS "Message_content_fts_idx" ON "Message" USING gin(to_tsvector('english', "content"));

-- Full-text search index on Conversation.title
CREATE INDEX IF NOT EXISTS "Conversation_title_fts_idx" ON "Conversation" USING gin(to_tsvector('english', "title"));