-- Idempotency ledger for external webhook deliveries (Stripe, etc.).
-- The provider's event id is the primary key so redelivered events are no-ops.

CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcessedWebhookEvent_provider_processedAt_idx"
    ON "ProcessedWebhookEvent" ("provider", "processedAt");
