-- Audit records that satisfy NIST 800-53 AU-3.
--
-- The trail recorded what happened, when, and who did it, but not where the
-- action came from or whether it succeeded — so a failed sign-in, a denied
-- approval, and a successful one were indistinguishable in shape. AU-3 asks for
-- all five. The new columns also give the /audit filters something to filter on.
--
-- Additive and idempotent, matching the convention in 20260801_governance_gates.

ALTER TABLE "AuditLogEntry"
  ADD COLUMN IF NOT EXISTS "actorIp" TEXT,
  ADD COLUMN IF NOT EXISTS "actorUserAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "outcome" TEXT NOT NULL DEFAULT 'success';

-- Existing rows all describe completed mutations, which is what the default
-- already says. No backfill is needed; the column is declared explicitly so the
-- intent is on the record.

-- Filtering the trail by action or by outcome is the whole point of the
-- auditor-facing view, so both get an index alongside the time ordering.
CREATE INDEX IF NOT EXISTS "AuditLogEntry_organizationId_action_createdAt_idx"
  ON "AuditLogEntry" ("organizationId", "action", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLogEntry_outcome_createdAt_idx"
  ON "AuditLogEntry" ("outcome", "createdAt");
