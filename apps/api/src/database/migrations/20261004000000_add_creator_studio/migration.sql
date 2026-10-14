CREATE TABLE "studio_ideas" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "concept" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "idea_notes" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "budget" TEXT,
    "reminder_date" TEXT,
    "shoot_location" TEXT,
    "equipment" TEXT,
    "source_url" TEXT,
    "attachment" JSONB,
    "notes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "studio_ideas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "studio_projects" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL,
    "budget" TEXT,
    "source_url" TEXT,
    "attachment" JSONB,
    "reminder_date" TEXT,
    "shoot_location" TEXT,
    "equipment" TEXT,
    "due_date" TEXT,
    "assigned_to" TEXT NOT NULL DEFAULT 'You',
    "current_stage" TEXT NOT NULL DEFAULT 'Idea',
    "workflow_steps" JSONB NOT NULL,
    "stage_data" JSONB NOT NULL,
    "validation_errors" JSONB NOT NULL DEFAULT '{}',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "studio_projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_ideas_owner_id_archived_updated_at_idx" ON "studio_ideas"("owner_id", "archived", "updated_at");
CREATE INDEX "studio_projects_owner_id_current_stage_archived_idx" ON "studio_projects"("owner_id", "current_stage", "archived");
CREATE UNIQUE INDEX "studio_projects_idea_id_key" ON "studio_projects"("idea_id");

ALTER TABLE "studio_ideas" ADD CONSTRAINT "studio_ideas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "studio_ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
