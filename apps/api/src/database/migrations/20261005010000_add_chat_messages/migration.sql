CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "client_message_id" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB,
    "reply_to_id" UUID,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_messages_application_id_sender_id_client_message_id_key"
ON "chat_messages"("application_id", "sender_id", "client_message_id");

CREATE INDEX "chat_messages_application_id_created_at_id_idx"
ON "chat_messages"("application_id", "created_at", "id");

CREATE INDEX "chat_messages_sender_id_created_at_idx"
ON "chat_messages"("sender_id", "created_at");

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_application_id_fkey"
FOREIGN KEY ("application_id") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
