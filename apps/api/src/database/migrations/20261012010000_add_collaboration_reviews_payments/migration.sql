ALTER TABLE "campaign_applications"
  ADD COLUMN "brand_completed_at" TIMESTAMP(3),
  ADD COLUMN "creator_completed_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3);

CREATE TABLE "campaign_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_payments_amount_nonnegative" CHECK ("amount" >= 0),
  CONSTRAINT "campaign_payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "campaign_payments_application_id_key" ON "campaign_payments"("application_id");
CREATE INDEX "campaign_payments_paid_at_updated_at_idx" ON "campaign_payments"("paid_at", "updated_at");

CREATE TABLE "campaign_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "campaign_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_reviews_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "campaign_reviews_application_id_author_id_key" ON "campaign_reviews"("application_id", "author_id");
CREATE INDEX "campaign_reviews_subject_id_created_at_idx" ON "campaign_reviews"("subject_id", "created_at");
CREATE INDEX "campaign_reviews_author_id_created_at_idx" ON "campaign_reviews"("author_id", "created_at");