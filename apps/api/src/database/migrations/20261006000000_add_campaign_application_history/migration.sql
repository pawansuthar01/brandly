CREATE TABLE "campaign_application_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_role" "UserRole" NOT NULL,
    "status" "CampaignApplicationStatus" NOT NULL,
    "invited_by_brand" BOOLEAN NOT NULL,
    "rejection_reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_application_events_pkey" PRIMARY KEY ("id")
);

INSERT INTO "campaign_application_events" (
    "application_id", "campaign_id", "creator_id", "actor_id", "actor_role", "status", "invited_by_brand", "occurred_at"
)
SELECT
    application."id",
    application."campaign_id",
    application."creator_id",
    CASE WHEN application."invited_by_brand" THEN campaign."brand_id" ELSE application."creator_id" END,
    CASE WHEN application."invited_by_brand" THEN 'BRAND'::"UserRole" ELSE 'CREATOR'::"UserRole" END,
    application."status",
    application."invited_by_brand",
    application."submitted_at"
FROM "campaign_applications" application
JOIN "campaigns" campaign ON campaign."id" = application."campaign_id";

CREATE INDEX "campaign_application_events_application_id_occurred_at_idx" ON "campaign_application_events"("application_id", "occurred_at");
CREATE INDEX "campaign_application_events_campaign_id_status_occurred_at_idx" ON "campaign_application_events"("campaign_id", "status", "occurred_at");
CREATE INDEX "campaign_application_events_creator_id_occurred_at_idx" ON "campaign_application_events"("creator_id", "occurred_at");

ALTER TABLE "campaign_application_events"
  ADD CONSTRAINT "campaign_application_events_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
