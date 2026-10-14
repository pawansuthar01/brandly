ALTER TABLE "notifications"
  ADD COLUMN "sound" TEXT,
  ADD COLUMN "channel_id" TEXT,
  ADD COLUMN "category_identifier" TEXT,
  ADD COLUMN "prefer_local_delivery" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "provider_ticket_ids" JSONB,
  ADD COLUMN "provider_ticket_tokens" JSONB,
  ADD COLUMN "delivery_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "accepted_at" TIMESTAMP(3),
  ADD COLUMN "receipt_checked_at" TIMESTAMP(3),
  ADD COLUMN "next_receipt_check_at" TIMESTAMP(3),
  ADD COLUMN "delivery_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_delivery_error" TEXT;

CREATE INDEX "notifications_channel_delivery_status_next_receipt_check_at_idx"
  ON "notifications"("channel", "delivery_status", "next_receipt_check_at");
