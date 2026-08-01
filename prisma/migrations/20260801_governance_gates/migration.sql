-- GovSecure governance gates: entity types + Gate 3 approval on AiSystem,
-- Gate 2 evaluation evidence + evidence reports.

-- ── AiSystem: entity type + approval (Gate 3) ───────────────────────────────
ALTER TABLE "AiSystem"
  ADD COLUMN "entityType" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "approvalStatus" TEXT,
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvalNote" TEXT;

-- Existing medium/high risk entries start as pending approval.
UPDATE "AiSystem"
SET "approvalStatus" = 'pending'
WHERE "riskCategory" IN ('high', 'moderate') AND "status" = 'active';

CREATE INDEX "AiSystem_approvalStatus_idx" ON "AiSystem"("approvalStatus");

-- ── EvaluationEvidence (Gate 2) ─────────────────────────────────────────────
CREATE TABLE "EvaluationEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "aiSystemId" TEXT NOT NULL,
  "reviewArea" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'data-science',
  "metric" TEXT,
  "result" TEXT NOT NULL,
  "meetsBaseline" BOOLEAN,
  "notes" TEXT,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvaluationEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EvaluationEvidence_aiSystemId_reviewArea_idx" ON "EvaluationEvidence"("aiSystemId", "reviewArea");
CREATE INDEX "EvaluationEvidence_userId_idx" ON "EvaluationEvidence"("userId");
CREATE INDEX "EvaluationEvidence_organizationId_idx" ON "EvaluationEvidence"("organizationId");

-- ── EvidenceReport (Gate 2) ─────────────────────────────────────────────────
CREATE TABLE "EvidenceReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "aiSystemId" TEXT NOT NULL,
  "verdict" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "areaFindings" JSONB NOT NULL,
  "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  "generatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EvidenceReport_aiSystemId_createdAt_idx" ON "EvidenceReport"("aiSystemId", "createdAt");
CREATE INDEX "EvidenceReport_userId_idx" ON "EvidenceReport"("userId");
