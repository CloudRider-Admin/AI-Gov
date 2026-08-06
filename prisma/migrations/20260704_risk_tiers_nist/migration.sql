-- Migrate AI system risk taxonomy from EU AI Act tiers to NIST/US impact tiers.
--
-- Mapping (4 EU tiers -> 3 NIST impact tiers):
--   prohibited -> high      (most severe collapses into High impact)
--   high       -> high
--   limited    -> moderate
--   minimal    -> low

UPDATE "AiSystem" SET "riskCategory" = 'high'     WHERE "riskCategory" IN ('prohibited', 'high');
UPDATE "AiSystem" SET "riskCategory" = 'moderate' WHERE "riskCategory" = 'limited';
UPDATE "AiSystem" SET "riskCategory" = 'low'      WHERE "riskCategory" = 'minimal';

-- Any unrecognized/legacy value defaults to the middle tier.
UPDATE "AiSystem" SET "riskCategory" = 'moderate'
  WHERE "riskCategory" NOT IN ('high', 'moderate', 'low');

ALTER TABLE "AiSystem" ALTER COLUMN "riskCategory" SET DEFAULT 'moderate';
