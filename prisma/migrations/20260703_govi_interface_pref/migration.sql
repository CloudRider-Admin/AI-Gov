-- Per-user Govi interface skin preference: "terminal" (classic) | "sovereign" (audit console).

ALTER TABLE "User" ADD COLUMN "goviInterface" TEXT NOT NULL DEFAULT 'terminal';
