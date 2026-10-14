ALTER TABLE "social_accounts"
  ADD COLUMN "display_name" TEXT,
  ADD COLUMN "follower_count" INTEGER,
  ADD COLUMN "following_count" INTEGER,
  ADD COLUMN "post_count" INTEGER,
  ADD COLUMN "profile_image_url" TEXT,
  ADD COLUMN "profile_metadata" JSONB,
  ADD COLUMN "sync_status" TEXT NOT NULL DEFAULT 'IDLE',
  ADD COLUMN "sync_error" TEXT,
  ADD COLUMN "last_synced_at" TIMESTAMP(3),
  ADD COLUMN "verification_method" TEXT;

CREATE INDEX "social_accounts_sync_status_last_synced_at_idx"
  ON "social_accounts"("sync_status", "last_synced_at");
