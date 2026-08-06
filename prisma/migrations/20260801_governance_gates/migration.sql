-- GovSecure governance gates, part two: the inventory-drawer model.
--
-- This runs AFTER 20260730_governance_gates, which builds the /gates board's
-- model (entityKind, GateRecord, EvaluationRun/Result/Baseline, IngestToken).
-- Both gate implementations are maintained, so this migration is purely
-- ADDITIVE: it must not drop anything 20260730 created.
--
-- Written defensively (IF EXISTS / IF NOT EXISTS) because production also
-- carries db-push drift from the abandoned first run of 20260730, so several
-- of these objects may already be present.

-- ── AiSystem: entity type + approval (Gate 3) ───────────────────────────────
ALTER TABLE "AiSystem"
  ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalNote" TEXT;

-- Seed the drawer's columns from the board's equivalents so an entity
-- registered through /gates shows up correctly in the inventory drawer.
-- entityKind (use-case | agent | model) is a subset of entityType's domain.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'AiSystem' AND column_name = 'entityKind') THEN
    UPDATE "AiSystem" SET "entityType" = "entityKind"
    WHERE "entityKind" IS NOT NULL AND "entityType" = 'system';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'AiSystem' AND column_name = 'approvedByName') THEN
    UPDATE "AiSystem" SET "approvedBy" = COALESCE("approvedBy", "approvedByName");
  END IF;
END $$;

-- 20260730 (and the drift before it) declared approvalStatus NOT NULL DEFAULT
-- 'not-required'. Both gate UIs now share the nullable convention, where NULL
-- means approval is not required. No-ops on a fresh database.
ALTER TABLE "AiSystem" ALTER COLUMN "approvalStatus" DROP NOT NULL;
ALTER TABLE "AiSystem" ALTER COLUMN "approvalStatus" DROP DEFAULT;

UPDATE "AiSystem" SET "approvalStatus" = NULL WHERE "approvalStatus" = 'not-required';

-- Existing high/moderate risk entries without a decision start as pending.
-- riskCategory is already on NIST tiers here: 20260704_risk_tiers_nist runs first.
UPDATE "AiSystem"
SET "approvalStatus" = 'pending'
WHERE "riskCategory" IN ('high', 'moderate')
  AND "status" = 'active'
  AND "approvalStatus" IS NULL;

CREATE INDEX IF NOT EXISTS "AiSystem_approvalStatus_idx" ON "AiSystem"("approvalStatus");

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
