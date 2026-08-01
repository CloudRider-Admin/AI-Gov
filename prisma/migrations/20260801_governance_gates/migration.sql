-- GovSecure governance gates: entity types + Gate 3 approval on AiSystem,
-- Gate 2 evaluation evidence + evidence reports.
--
-- Written defensively (IF EXISTS / IF NOT EXISTS): a prior abandoned gates
-- attempt (failed migration 20260730_governance_gates + db-push drift) left
-- production with stray columns (entityKind, approvedById, approvedByName,
-- approvalExpiresAt), an AiSystem_approvalStatus_idx index, and empty
-- EvaluationRun/EvaluationResult/EvaluationBaseline tables. This migration
-- converges both fresh and drifted databases to the schema.

-- ── AiSystem: entity type + approval (Gate 3) ───────────────────────────────
ALTER TABLE "AiSystem"
  ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalNote" TEXT;

-- Carry data over from the abandoned attempt's columns, then drop them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'AiSystem' AND column_name = 'entityKind') THEN
    UPDATE "AiSystem" SET "entityType" = "entityKind" WHERE "entityKind" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'AiSystem' AND column_name = 'approvedByName') THEN
    UPDATE "AiSystem" SET "approvedBy" = COALESCE("approvedBy", "approvedByName");
  END IF;
END $$;

ALTER TABLE "AiSystem"
  DROP COLUMN IF EXISTS "entityKind",
  DROP COLUMN IF EXISTS "approvedById",
  DROP COLUMN IF EXISTS "approvedByName",
  DROP COLUMN IF EXISTS "approvalExpiresAt";

DROP INDEX IF EXISTS "AiSystem_userId_entityKind_status_idx";

-- The drifted column was NOT NULL DEFAULT 'not-required'; this schema uses a
-- nullable column with no default (NULL = approval not required). No-ops on a
-- fresh database.
ALTER TABLE "AiSystem" ALTER COLUMN "approvalStatus" DROP NOT NULL;
ALTER TABLE "AiSystem" ALTER COLUMN "approvalStatus" DROP DEFAULT;

-- Normalize to this schema's convention: NULL means approval not required.
UPDATE "AiSystem" SET "approvalStatus" = NULL WHERE "approvalStatus" = 'not-required';

-- Existing medium/high risk entries without a decision start as pending.
UPDATE "AiSystem"
SET "approvalStatus" = 'pending'
WHERE "riskCategory" IN ('high', 'moderate')
  AND "status" = 'active'
  AND "approvalStatus" IS NULL;

CREATE INDEX IF NOT EXISTS "AiSystem_approvalStatus_idx" ON "AiSystem"("approvalStatus");

-- Abandoned Gate 2 design from the prior attempt (all empty).
DROP TABLE IF EXISTS "EvaluationResult";
DROP TABLE IF EXISTS "EvaluationRun";
DROP TABLE IF EXISTS "EvaluationBaseline";

-- ── EvaluationEvidence (Gate 2) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EvaluationEvidence" (
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
CREATE INDEX IF NOT EXISTS "EvaluationEvidence_aiSystemId_reviewArea_idx" ON "EvaluationEvidence"("aiSystemId", "reviewArea");
CREATE INDEX IF NOT EXISTS "EvaluationEvidence_userId_idx" ON "EvaluationEvidence"("userId");
CREATE INDEX IF NOT EXISTS "EvaluationEvidence_organizationId_idx" ON "EvaluationEvidence"("organizationId");

-- ── EvidenceReport (Gate 2) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EvidenceReport" (
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
CREATE INDEX IF NOT EXISTS "EvidenceReport_aiSystemId_createdAt_idx" ON "EvidenceReport"("aiSystemId", "createdAt");
CREATE INDEX IF NOT EXISTS "EvidenceReport_userId_idx" ON "EvidenceReport"("userId");
