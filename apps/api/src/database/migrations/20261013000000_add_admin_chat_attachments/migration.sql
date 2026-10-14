ALTER TABLE "admin_chat_messages"
ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb;
