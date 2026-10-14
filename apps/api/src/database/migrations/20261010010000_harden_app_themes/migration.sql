ALTER TABLE "app_theme_drafts" ADD COLUMN "published_revision" INTEGER;
CREATE INDEX "app_theme_drafts_scope_updated_at_id_idx" ON "app_theme_drafts"("scope", "updated_at", "id");
DROP INDEX "app_theme_versions_scope_created_at_idx";
CREATE INDEX "app_theme_versions_scope_created_at_id_idx" ON "app_theme_versions"("scope", "created_at", "id");
DROP INDEX "app_theme_activations_scope_created_at_idx";
CREATE INDEX "app_theme_activations_scope_created_at_id_idx" ON "app_theme_activations"("scope", "created_at", "id");
