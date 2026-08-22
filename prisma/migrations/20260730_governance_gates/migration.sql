-- Governance gates: Gate 1 (intake & risk tiering), Gate 2 (evaluation &
-- review), Gate 3 (approval & registry). Adds entity kinds and approval state
-- to the AI system register, plus the evaluation evidence chain behind Gate 2.
--
-- Written to be idempotent. Part of this schema reached at least one database
-- ahead of the migration history (an out-of-band `prisma db push` will do it),
-- which made a plain CREATE/ADD fail with 42701 and left the migration stuck in
-- a failed state. Every statement below can therefore run against a database
-- that already has some, all, or none of it, and the two backfills only ever
-- touch rows they have not already touched.

-- ── AiSystem: entity kind + Gate 3 approval columns ─────────────────────────
ALTER TABLE "AiSystem"
  ADD COLUMN IF NOT EXISTS "entityKind" TEXT NOT NULL DEFAULT 'use-case',
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'not-required',
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalNote" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AiSystem_userId_entityKind_status_idx" ON "AiSystem"("userId", "entityKind", "status");
CREATE INDEX IF NOT EXISTS "AiSystem_approvalStatus_idx" ON "AiSystem"("approvalStatus");

-- Existing rows: anything at medium severity or above (EU AI Act limited/high/
-- prohibited) needs an approval decision, so backfill those to 'pending'.
-- 'minimal' maps to low severity and stays 'not-required'.
--
-- Guarded on the default value, not just on risk tier: without that, a re-run
-- would drag entities that have since been approved or rejected back to
-- 'pending' and silently discard a recorded governance decision.
UPDATE "AiSystem"
   SET "approvalStatus" = 'pending'
 WHERE "riskCategory" IN ('prohibited', 'high', 'limited')
   AND "status" = 'active'
   AND "approvalStatus" = 'not-required';

-- ── GateRecord ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GateRecord" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "GateRecord_aiSystemId_gate_key" ON "GateRecord"("aiSystemId", "gate");
CREATE INDEX IF NOT EXISTS "GateRecord_userId_status_idx" ON "GateRecord"("userId", "status");
CREATE INDEX IF NOT EXISTS "GateRecord_organizationId_gate_idx" ON "GateRecord"("organizationId", "gate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GateRecord_aiSystemId_fkey') THEN
    ALTER TABLE "GateRecord"
      ADD CONSTRAINT "GateRecord_aiSystemId_fkey"
      FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── EvaluationRun ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EvaluationRun" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationRun_aiSystemId_runLabel_key" ON "EvaluationRun"("aiSystemId", "runLabel");
CREATE INDEX IF NOT EXISTS "EvaluationRun_aiSystemId_createdAt_idx" ON "EvaluationRun"("aiSystemId", "createdAt");
CREATE INDEX IF NOT EXISTS "EvaluationRun_userId_status_idx" ON "EvaluationRun"("userId", "status");
CREATE INDEX IF NOT EXISTS "EvaluationRun_organizationId_createdAt_idx" ON "EvaluationRun"("organizationId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvaluationRun_aiSystemId_fkey') THEN
    ALTER TABLE "EvaluationRun"
      ADD CONSTRAINT "EvaluationRun_aiSystemId_fkey"
      FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── EvaluationResult ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EvaluationResult" (
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
CREATE INDEX IF NOT EXISTS "EvaluationResult_runId_area_idx" ON "EvaluationResult"("runId", "area");
CREATE INDEX IF NOT EXISTS "EvaluationResult_verdict_idx" ON "EvaluationResult"("verdict");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvaluationResult_runId_fkey') THEN
    ALTER TABLE "EvaluationResult"
      ADD CONSTRAINT "EvaluationResult_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "EvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── IngestToken ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "IngestToken" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "IngestToken_tokenHash_key" ON "IngestToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "IngestToken_userId_revokedAt_idx" ON "IngestToken"("userId", "revokedAt");

-- ── EvaluationBaseline ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EvaluationBaseline" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationBaseline_userId_area_key" ON "EvaluationBaseline"("userId", "area");
CREATE INDEX IF NOT EXISTS "EvaluationBaseline_organizationId_area_idx" ON "EvaluationBaseline"("organizationId", "area");

-- ── Reconcile columns on tables that may pre-exist ──────────────────────────
-- CREATE TABLE IF NOT EXISTS is a no-op against a table that already exists,
-- even if that table is missing columns — which is exactly the state an
-- out-of-band push from an intermediate commit would leave behind. These
-- statements make the shape converge rather than assuming it.
ALTER TABLE "GateRecord"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'not-started',
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "decidedById" TEXT,
  ADD COLUMN IF NOT EXISTS "decidedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);

ALTER TABLE "EvaluationRun"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT,
  ADD COLUMN IF NOT EXISTS "evaluatorTeam" TEXT,
  ADD COLUMN IF NOT EXISTS "evaluatorName" TEXT,
  ADD COLUMN IF NOT EXISTS "platform" TEXT,
  ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "overallVerdict" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "reportMarkdown" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT NOT NULL DEFAULT 'govi',
  ADD COLUMN IF NOT EXISTS "coverageRatio" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rawPayload" TEXT;

ALTER TABLE "EvaluationResult"
  ADD COLUMN IF NOT EXISTS "metricValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "unit" TEXT,
  ADD COLUMN IF NOT EXISTS "textValue" TEXT,
  ADD COLUMN IF NOT EXISTS "method" TEXT,
  ADD COLUMN IF NOT EXISTS "sampleSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "evidenceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "verdict" TEXT NOT NULL DEFAULT 'not-assessed',
  ADD COLUMN IF NOT EXISTS "baselineNote" TEXT,
  ADD COLUMN IF NOT EXISTS "gap" TEXT,
  ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "IngestToken"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "prefix" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

ALTER TABLE "EvaluationBaseline"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "comparator" TEXT NOT NULL DEFAULT 'gte',
  ADD COLUMN IF NOT EXISTS "threshold" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "unit" TEXT,
  ADD COLUMN IF NOT EXISTS "appliesToRisk" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── Backfill Gate 1 for entities already in the register ────────────────────
-- An existing row that already carries a risk tier and a business owner has, in
-- substance, cleared intake; record that rather than resetting everyone to zero.
-- ON CONFLICT DO NOTHING keeps a re-run from colliding on either the primary key
-- or the (aiSystemId, gate) unique index, and from overwriting a gate record
-- that the application has since moved on from.
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
WHERE "status" = 'active'
ON CONFLICT DO NOTHING;
