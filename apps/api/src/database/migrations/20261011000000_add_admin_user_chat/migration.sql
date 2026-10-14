CREATE TABLE "admin_chat_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_chat_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_role" "UserRole" NOT NULL,
    "client_message_id" TEXT,
    "text" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_chat_conversations_user_id_key" ON "admin_chat_conversations"("user_id");
CREATE INDEX "admin_chat_conversations_updated_at_idx" ON "admin_chat_conversations"("updated_at");
CREATE UNIQUE INDEX "admin_chat_messages_conversation_id_sender_id_client_message_id_key" ON "admin_chat_messages"("conversation_id", "sender_id", "client_message_id");
CREATE INDEX "admin_chat_messages_conversation_id_created_at_id_idx" ON "admin_chat_messages"("conversation_id", "created_at", "id");
CREATE INDEX "admin_chat_messages_sender_id_created_at_idx" ON "admin_chat_messages"("sender_id", "created_at");

ALTER TABLE "admin_chat_conversations" ADD CONSTRAINT "admin_chat_conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_chat_messages" ADD CONSTRAINT "admin_chat_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "admin_chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_chat_messages" ADD CONSTRAINT "admin_chat_messages_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
