ALTER TABLE "chat_messages"
  ADD COLUMN "task_id" UUID,
  ADD COLUMN "campaign_application_id" UUID;

CREATE INDEX "chat_messages_task_id_idx" ON "chat_messages"("task_id");
CREATE INDEX "chat_messages_campaign_application_id_idx" ON "chat_messages"("campaign_application_id");
