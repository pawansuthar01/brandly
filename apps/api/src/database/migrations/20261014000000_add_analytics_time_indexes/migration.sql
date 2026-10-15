CREATE INDEX IF NOT EXISTS "campaigns_created_at_idx"
ON "campaigns"("created_at");

CREATE INDEX IF NOT EXISTS "campaign_applications_submitted_at_idx"
ON "campaign_applications"("submitted_at");

CREATE INDEX IF NOT EXISTS "campaign_applications_completed_at_idx"
ON "campaign_applications"("completed_at");

CREATE INDEX IF NOT EXISTS "tasks_created_at_idx"
ON "tasks"("created_at");

CREATE INDEX IF NOT EXISTS "tasks_completed_at_idx"
ON "tasks"("completed_at");

CREATE INDEX IF NOT EXISTS "notifications_created_at_channel_idx"
ON "notifications"("created_at", "channel");

CREATE INDEX IF NOT EXISTS "chat_messages_created_at_idx"
ON "chat_messages"("created_at");

CREATE INDEX IF NOT EXISTS "admin_chat_messages_created_at_idx"
ON "admin_chat_messages"("created_at");
