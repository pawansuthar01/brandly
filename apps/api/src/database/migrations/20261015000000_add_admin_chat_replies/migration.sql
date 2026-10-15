ALTER TABLE "admin_chat_messages"
ADD COLUMN "reply_to_id" UUID;

ALTER TABLE "admin_chat_messages"
ADD CONSTRAINT "admin_chat_messages_reply_to_id_fkey"
FOREIGN KEY ("reply_to_id") REFERENCES "admin_chat_messages"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "admin_chat_messages_reply_to_id_idx"
ON "admin_chat_messages"("reply_to_id");
