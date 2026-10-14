CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "CampaignVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "CampaignApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target_locations" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "deadline_at" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "CampaignVisibility" NOT NULL DEFAULT 'PUBLIC',
    "platforms" JSONB NOT NULL,
    "deliverables" TEXT NOT NULL DEFAULT '',
    "requirements" JSONB NOT NULL,
    "creator_requirements" TEXT NOT NULL DEFAULT '',
    "media" JSONB NOT NULL,
    "collaboration_video_url" TEXT,
    "collaboration_video_label" TEXT,
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaign_applications" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "status" "CampaignApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_brand" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL DEFAULT '',
    "responses" JSONB NOT NULL,
    "attachments" JSONB NOT NULL,
    "contact_shared" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campaigns_brand_id_status_updated_at_idx" ON "campaigns"("brand_id", "status", "updated_at");
CREATE INDEX "campaigns_status_deadline_at_idx" ON "campaigns"("status", "deadline_at");
CREATE UNIQUE INDEX "campaign_applications_campaign_id_creator_id_key" ON "campaign_applications"("campaign_id", "creator_id");
CREATE INDEX "campaign_applications_creator_id_status_updated_at_idx" ON "campaign_applications"("creator_id", "status", "updated_at");
CREATE INDEX "campaign_applications_campaign_id_status_updated_at_idx" ON "campaign_applications"("campaign_id", "status", "updated_at");

ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
