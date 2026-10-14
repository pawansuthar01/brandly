CREATE TABLE "app_theme_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" JSONB NOT NULL,
  "change_note" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_theme_drafts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "app_theme_drafts_scope_name_key" ON "app_theme_drafts"("scope", "name");
CREATE TABLE "app_theme_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "document" JSONB NOT NULL,
  "change_note" TEXT NOT NULL DEFAULT '',
  "source_id" UUID,
  "author_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_theme_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "app_theme_versions_scope_name_revision_key" ON "app_theme_versions"("scope", "name", "revision");
CREATE INDEX "app_theme_versions_scope_created_at_idx" ON "app_theme_versions"("scope", "created_at");
CREATE TABLE "app_theme_activations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" TEXT NOT NULL,
  "version_id" UUID NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_theme_activations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_theme_activations_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "app_theme_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "app_theme_activations_scope_created_at_idx" ON "app_theme_activations"("scope", "created_at");
CREATE TABLE "app_theme_current" (
  "scope" TEXT NOT NULL,
  "version_id" UUID NOT NULL,
  "actor_id" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_theme_current_pkey" PRIMARY KEY ("scope"),
  CONSTRAINT "app_theme_current_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "app_theme_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
