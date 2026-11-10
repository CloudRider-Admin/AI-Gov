-- Organizational profile captured during client onboarding (step 1 of the
-- onboarding wizard: org name, industry, size band, primary jurisdiction).
--
-- All nullable — existing users predate the profile step. Written with
-- IF NOT EXISTS so it is safe to re-apply against a database that already
-- carries the columns from an out-of-band `prisma db push`.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "orgName" TEXT,
  ADD COLUMN IF NOT EXISTS "orgIndustry" TEXT,
  ADD COLUMN IF NOT EXISTS "orgSize" TEXT,
  ADD COLUMN IF NOT EXISTS "orgJurisdiction" TEXT;
