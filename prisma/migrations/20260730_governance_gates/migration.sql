-- Governance gates: Gate 1 (intake & risk tiering), Gate 2 (evaluation &
-- review), Gate 3 (approval & registry). Adds entity kinds and approval state
-- to the AI system register, plus the evaluation evidence chain behind Gate 2.

-- ── AiSystem: entity kind + Gate 3 approval columns ─────────────────────────
ALTER TABLE "AiSystem"
  ADD COLUMN "entityKind" TEXT NOT NULL DEFAULT 'use-case',
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'not-required',
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedByName" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "approvalExpiresAt" TIMESTAMP(3);

CREATE INDEX "AiSystem_userId_entityKind_status_idx" ON "AiSystem"("userId", "entityKind", "status");
CREATE INDEX "AiSystem_approvalStatus_idx" ON "AiSystem"("approvalStatus");

-- Existing rows: anything at medium severity or above (EU AI Act limited/high/
-- prohibited) needs an approval decision, so backfill those to 'pending'.
-- 'minimal' maps to low severity and stays 'not-required'.
UPDATE "AiSystem"
   SET "approvalStatus" = 'pending'
 WHERE "riskCategory" IN ('prohibited', 'high', 'limited')
   AND "status" = 'active';

-- ── GateRecord ──────────────────────────────────────────────────────────────
CREATE TABLE "GateRecord" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "gate" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not-started',
  "summary" TEXT,
  "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GateRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GateRecord_aiSystemId_gate_key" ON "GateRecord"("aiSystemId", "gate");
CREATE INDEX "GateRecord_userId_status_idx" ON "GateRecord"("userId", "status");
CREATE INDEX "GateRecord_organizationId_gate_idx" ON "GateRecord"("organizationId", "gate");
ALTER TABLE "GateRecord"
  ADD CONSTRAINT "GateRecord_aiSystemId_fkey"
  FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── EvaluationRun ───────────────────────────────────────────────────────────
CREATE TABLE "EvaluationRun" (
  "id" TEXT NOT NULL,
  "aiSystemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "runLabel" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sourceRef" TEXT,
  "evaluatorTeam" TEXT,
  "evaluatorName" TEXT,
  "platform" TEXT,
  "evaluatedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'draft',
  "overallVerdict" TEXT,
  "reviewSummary" TEXT,
  "reportMarkdown" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT NOT NULL DEFAULT 'govi',
  "coverageRatio" DOUBLE PRECISION,
  "rawPayload" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EvaluationRun_aiSystemId_runLabel_key" ON "EvaluationRun"("aiSystemId", "runLabel");
CREATE INDEX "EvaluationRun_aiSystemId_createdAt_idx" ON "EvaluationRun"("aiSystemId", "createdAt");
CREATE INDEX "EvaluationRun_userId_status_idx" ON "EvaluationRun"("userId", "status");
CREATE INDEX "EvaluationRun_organizationId_createdAt_idx" ON "EvaluationRun"("organizationId", "createdAt");
ALTER TABLE "EvaluationRun"
  ADD CONSTRAINT "EvaluationRun_aiSystemId_fkey"
  FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── EvaluationResult ────────────────────────────────────────────────────────
CREATE TABLE "EvaluationResult" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "parameter" TEXT NOT NULL,
  "metricValue" DOUBLE PRECISION,
  "unit" TEXT,
  "textValue" TEXT,
  "method" TEXT,
  "sampleSize" INTEGER,
  "evidenceUrl" TEXT,
  "verdict" TEXT NOT NULL DEFAULT 'not-assessed',
  "baselineNote" TEXT,
  "gap" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'none',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EvaluationResult_runId_area_idx" ON "EvaluationResult"("runId", "area");
CREATE INDEX "EvaluationResult_verdict_idx" ON "EvaluationResult"("verdict");
ALTER TABLE "EvaluationResult"
  ADD CONSTRAINT "EvaluationResult_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "EvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── IngestToken ─────────────────────────────────────────────────────────────
CREATE TABLE "IngestToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngestToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngestToken_tokenHash_key" ON "IngestToken"("tokenHash");
CREATE INDEX "IngestToken_userId_revokedAt_idx" ON "IngestToken"("userId", "revokedAt");

-- ── EvaluationBaseline ──────────────────────────────────────────────────────
CREATE TABLE "EvaluationBaseline" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "area" TEXT NOT NULL,
  "comparator" TEXT NOT NULL DEFAULT 'gte',
  "threshold" DOUBLE PRECISION,
  "unit" TEXT,
  "expectation" TEXT NOT NULL,
  "appliesToRisk" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvaluationBaseline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EvaluationBaseline_userId_area_key" ON "EvaluationBaseline"("userId", "area");
CREATE INDEX "EvaluationBaseline_organizationId_area_idx" ON "EvaluationBaseline"("organizationId", "area");

-- ── Backfill Gate 1 for entities already in the register ────────────────────
-- An existing row that already carries a risk tier and a business owner has, in
-- substance, cleared intake; record that rather than resetting everyone to zero.
INSERT INTO "GateRecord" ("id", "aiSystemId", "userId", "organizationId", "gate", "status", "summary", "decidedAt", "createdAt", "updatedAt")
SELECT
  'gr1_' || "id",
  "id",
  "userId",
  "organizationId",
  1,
  CASE WHEN "businessOwner" IS NOT NULL AND "businessOwner" <> '' THEN 'passed' ELSE 'in-progress' END,
  CASE WHEN "businessOwner" IS NOT NULL AND "businessOwner" <> ''
       THEN 'Backfilled: risk tier and business owner were already recorded at migration time.'
       ELSE 'Backfilled: risk tier recorded, business owner still missing.' END,
  CASE WHEN "businessOwner" IS NOT NULL AND "businessOwner" <> '' THEN "updatedAt" ELSE NULL END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AiSystem"
WHERE "status" = 'active';
