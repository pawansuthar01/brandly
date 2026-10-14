CREATE TABLE "task_recipients" (
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_recipients_pkey" PRIMARY KEY ("task_id", "user_id")
);

CREATE INDEX "task_recipients_user_id_shared_at_idx" ON "task_recipients"("user_id", "shared_at");

ALTER TABLE "task_recipients" ADD CONSTRAINT "task_recipients_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_recipients" ADD CONSTRAINT "task_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
