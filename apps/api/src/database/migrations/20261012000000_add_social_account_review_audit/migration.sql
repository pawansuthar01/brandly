ALTER TABLE "social_accounts"
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by" TEXT,
  ADD COLUMN "reviewer_note" TEXT;
