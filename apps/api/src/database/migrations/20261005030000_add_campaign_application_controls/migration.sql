ALTER TABLE "campaigns"
  ADD COLUMN "application_limit" INTEGER,
  ADD COLUMN "approval_limit" INTEGER,
  ADD COLUMN "close_on_application_limit" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "campaign_applications"
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "allow_reapply" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_application_limit_check" CHECK ("application_limit" IS NULL OR "application_limit" > 0),
  ADD CONSTRAINT "campaigns_approval_limit_check" CHECK ("approval_limit" IS NULL OR "approval_limit" > 0);
