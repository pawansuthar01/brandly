CREATE TYPE "AccountReactivationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "users"
ADD COLUMN "suspension_reason" TEXT,
ADD COLUMN "suspended_at" TIMESTAMP(3);

CREATE TABLE "account_reactivation_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AccountReactivationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_reactivation_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_reactivation_requests_status_created_at_id_idx"
ON "account_reactivation_requests"("status", "created_at", "id");
CREATE INDEX "account_reactivation_requests_user_id_created_at_idx"
ON "account_reactivation_requests"("user_id", "created_at");
CREATE UNIQUE INDEX "account_reactivation_one_pending_per_user"
ON "account_reactivation_requests"("user_id") WHERE "status" = 'PENDING';

ALTER TABLE "account_reactivation_requests"
ADD CONSTRAINT "account_reactivation_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
