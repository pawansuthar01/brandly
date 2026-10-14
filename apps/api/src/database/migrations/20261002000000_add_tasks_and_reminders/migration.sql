CREATE TYPE "TaskReminderStatus" AS ENUM ('NONE', 'PENDING', 'SENDING', 'SENT', 'STOPPED', 'FAILED');

CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'task',
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "due_date" TEXT NOT NULL,
    "due_time" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder_tone" TEXT NOT NULL DEFAULT 'default',
    "reminder_status" "TaskReminderStatus" NOT NULL DEFAULT 'NONE',
    "reminder_sent_at" TIMESTAMP(3),
    "reminder_stopped_at" TIMESTAMP(3),
    "reminder_claimed_at" TIMESTAMP(3),
    "reminder_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_error" TEXT,
    "completed_at" TIMESTAMP(3),
    "links" JSONB,
    "attachments" JSONB,
    "project_id" TEXT,
    "stage" TEXT,
    "campaign_id" TEXT,
    "conversation_id" TEXT,
    "source_task_id" UUID,
    "created_by_id" UUID NOT NULL,
    "brand_id" UUID,
    "creator_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_activities" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_created_by_id_created_at_idx" ON "tasks"("created_by_id", "created_at");
CREATE INDEX "tasks_brand_id_due_at_idx" ON "tasks"("brand_id", "due_at");
CREATE INDEX "tasks_creator_id_due_at_idx" ON "tasks"("creator_id", "due_at");
CREATE INDEX "tasks_reminder_enabled_reminder_status_due_at_idx" ON "tasks"("reminder_enabled", "reminder_status", "due_at");
CREATE INDEX "task_activities_task_id_created_at_idx" ON "task_activities"("task_id", "created_at");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
