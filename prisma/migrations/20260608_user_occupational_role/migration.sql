-- Add optional occupational role captured at onboarding (e.g. "Security / CISO").
-- Used to tailor advisor clarifying questions and surface the requestor lens on
-- generated intake risk assessments.
ALTER TABLE "User" ADD COLUMN "occupationalRole" TEXT;
