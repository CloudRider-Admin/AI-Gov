-- Separation of duties on Gate 3 approvals, and an expiry on gate waivers.
--
-- Two integrity holes are closed by the code that accompanies this migration:
--
--   1. An approval could be recorded by the entity's own owner. It still can be
--      in a single-operator workspace — there is nobody else to ask — but the
--      fact is now recorded on the register instead of being invisible.
--   2. A waiver suppressed recomputation of its gate forever, so one sentence
--      permanently silenced the evaluation gate. Waivers now expire.
--
-- Additive and idempotent, matching the convention established by
-- 20260801_governance_gates: production carries db-push drift from the
-- abandoned first run of 20260730, so every object is guarded.

-- ── AiSystem: was the approval self-recorded? ───────────────────────────────
ALTER TABLE "AiSystem"
  ADD COLUMN IF NOT EXISTS "approvalSelfRecorded" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from what the existing rows can tell us. `approvedById` is written by
-- the /gates board; where it matches the owner, the decision was self-recorded.
-- Rows approved through the retired inventory-drawer path only ever recorded a
-- display name, and that path had no approver identity separate from the owner,
-- so those are self-recorded by construction.
UPDATE "AiSystem"
SET "approvalSelfRecorded" = true
WHERE "approvalStatus" IN ('approved', 'rejected')
  AND (
    "approvedById" = "userId"
    OR ("approvedById" IS NULL AND "approvedBy" IS NOT NULL)
  );

-- ── GateRecord: waiver expiry + provenance ──────────────────────────────────
ALTER TABLE "GateRecord"
  ADD COLUMN IF NOT EXISTS "waiverExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waiverSelfGranted" BOOLEAN NOT NULL DEFAULT false;

-- Existing waivers were granted with no expiry and, under the old rules, only
-- ever by the entity's owner. Give them the standard 90-day life measured from
-- when they were decided so they re-enter review rather than lapsing instantly
-- and reopening every gate on the next deploy.
UPDATE "GateRecord"
SET
  "waiverExpiresAt" = COALESCE("decidedAt", "createdAt") + INTERVAL '90 days',
  "waiverSelfGranted" = true
WHERE "status" = 'waived'
  AND "waiverExpiresAt" IS NULL;

-- The recomputation path filters on (status, waiverExpiresAt) to decide whether
-- a waiver still suppresses its gate.
CREATE INDEX IF NOT EXISTS "GateRecord_status_waiverExpiresAt_idx"
  ON "GateRecord" ("status", "waiverExpiresAt");
