-- Add conversation-scoped organization context metadata
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- Create workflow session table for multi-turn document workflows
CREATE TABLE IF NOT EXISTS "WorkflowSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "workflowType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in-progress',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkflowSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkflowSession_userId_status_idx" ON "WorkflowSession"("userId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowSession_conversationId_idx" ON "WorkflowSession"("conversationId");
