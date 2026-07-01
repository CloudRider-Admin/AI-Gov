-- AAA governance foundation: Tiers 1–3 models + Tier 2 field additions.

-- ── GeneratedArtifact review workflow (Tier 2) ──────────────────────────────
ALTER TABLE "GeneratedArtifact"
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- ── AiSystem (Tier 1a) ──────────────────────────────────────────────────────
CREATE TABLE "AiSystem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "purpose" TEXT,
  "businessOwner" TEXT,
  "vendor" TEXT,
  "model" TEXT,
  "lifecycleStage" TEXT NOT NULL DEFAULT 'idea',
  "riskCategory" TEXT NOT NULL DEFAULT 'limited',
  "status" TEXT NOT NULL DEFAULT 'active',
  "dataTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "deployedAt" TIMESTAMP(3),
  "lastReviewedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiSystem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiSystem_userId_status_idx" ON "AiSystem"("userId", "status");
CREATE INDEX "AiSystem_organizationId_idx" ON "AiSystem"("organizationId");
CREATE INDEX "AiSystem_riskCategory_idx" ON "AiSystem"("riskCategory");
CREATE INDEX "AiSystem_nextReviewAt_idx" ON "AiSystem"("nextReviewAt");

-- ── ControlAssessment (Tier 1b) ─────────────────────────────────────────────
CREATE TABLE "ControlAssessment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "framework" TEXT NOT NULL,
  "controlId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not-started',
  "evidence" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ControlAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ControlAssessment_userId_framework_controlId_key" ON "ControlAssessment"("userId", "framework", "controlId");
CREATE INDEX "ControlAssessment_organizationId_framework_idx" ON "ControlAssessment"("organizationId", "framework");

-- ── RemediationTask (Tier 1c) ───────────────────────────────────────────────
CREATE TABLE "RemediationTask" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'todo',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "dueDate" TIMESTAMP(3),
  "assigneeId" TEXT,
  "aiSystemId" TEXT,
  "framework" TEXT,
  "controlId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RemediationTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RemediationTask_userId_status_idx" ON "RemediationTask"("userId", "status");
CREATE INDEX "RemediationTask_organizationId_status_idx" ON "RemediationTask"("organizationId", "status");
CREATE INDEX "RemediationTask_assigneeId_idx" ON "RemediationTask"("assigneeId");
CREATE INDEX "RemediationTask_dueDate_idx" ON "RemediationTask"("dueDate");

-- ── AuditLogEntry (Tier 1d) ─────────────────────────────────────────────────
CREATE TABLE "AuditLogEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLogEntry_organizationId_createdAt_idx" ON "AuditLogEntry"("organizationId", "createdAt");
CREATE INDEX "AuditLogEntry_actorId_createdAt_idx" ON "AuditLogEntry"("actorId", "createdAt");
CREATE INDEX "AuditLogEntry_entityType_entityId_idx" ON "AuditLogEntry"("entityType", "entityId");

-- ── OrgInvitation (Tier 2) ──────────────────────────────────────────────────
CREATE TABLE "OrgInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrgInvitation_tokenHash_key" ON "OrgInvitation"("tokenHash");
CREATE INDEX "OrgInvitation_organizationId_status_idx" ON "OrgInvitation"("organizationId", "status");
CREATE INDEX "OrgInvitation_email_idx" ON "OrgInvitation"("email");
ALTER TABLE "OrgInvitation"
  ADD CONSTRAINT "OrgInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── MaturitySnapshot (Tier 3) ───────────────────────────────────────────────
CREATE TABLE "MaturitySnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "score" INTEGER NOT NULL,
  "dimensions" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'computed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaturitySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaturitySnapshot_userId_createdAt_idx" ON "MaturitySnapshot"("userId", "createdAt");
CREATE INDEX "MaturitySnapshot_organizationId_createdAt_idx" ON "MaturitySnapshot"("organizationId", "createdAt");

-- ── RegulatoryUpdate (Tier 3) ───────────────────────────────────────────────
CREATE TABLE "RegulatoryUpdate" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "framework" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "url" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RegulatoryUpdate_isActive_publishedAt_idx" ON "RegulatoryUpdate"("isActive", "publishedAt");
CREATE INDEX "RegulatoryUpdate_jurisdiction_idx" ON "RegulatoryUpdate"("jurisdiction");
