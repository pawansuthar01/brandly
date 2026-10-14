CREATE TYPE "ProfileInteractionType" AS ENUM ('SAVED', 'BLOCKED', 'COMPARED');

CREATE TABLE "profile_interactions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "type" "ProfileInteractionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profile_interactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_interactions_owner_id_target_id_type_key" ON "profile_interactions"("owner_id", "target_id", "type");
CREATE INDEX "profile_interactions_owner_id_type_updated_at_idx" ON "profile_interactions"("owner_id", "type", "updated_at");
CREATE INDEX "profile_interactions_target_id_type_updated_at_idx" ON "profile_interactions"("target_id", "type", "updated_at");

ALTER TABLE "profile_interactions" ADD CONSTRAINT "profile_interactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_interactions" ADD CONSTRAINT "profile_interactions_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
