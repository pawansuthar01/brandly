CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "IndiaAdministrativeKind" AS ENUM ('STATE', 'UNION_TERRITORY');
CREATE TYPE "IndiaPlaceKind" AS ENUM ('CITY', 'TOWN', 'URBAN_LOCAL_BODY', 'OTHER');

CREATE TABLE "location_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lgd_code" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "local_name" TEXT,
  "kind" "IndiaAdministrativeKind" NOT NULL,
  "census_2011_code" TEXT,
  "last_source_updated_at" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "location_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "location_states_lgd_code_key" ON "location_states"("lgd_code");
CREATE INDEX "location_states_name_idx" ON "location_states"("name");
CREATE INDEX "location_states_kind_is_active_idx" ON "location_states"("kind", "is_active");

CREATE TABLE "location_districts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lgd_code" INTEGER NOT NULL,
  "state_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "local_name" TEXT,
  "census_2011_code" TEXT,
  "last_source_updated_at" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "location_districts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "location_districts_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "location_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "location_districts_lgd_code_key" ON "location_districts"("lgd_code");
CREATE INDEX "location_districts_state_id_name_idx" ON "location_districts"("state_id", "name");
CREATE INDEX "location_districts_name_idx" ON "location_districts"("name");

CREATE TABLE "location_subdistricts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lgd_code" INTEGER NOT NULL,
  "district_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "local_name" TEXT,
  "census_2011_code" TEXT,
  "last_source_updated_at" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "location_subdistricts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "location_subdistricts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "location_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "location_subdistricts_lgd_code_key" ON "location_subdistricts"("lgd_code");
CREATE INDEX "location_subdistricts_district_id_name_idx" ON "location_subdistricts"("district_id", "name");
CREATE INDEX "location_subdistricts_name_idx" ON "location_subdistricts"("name");

CREATE TABLE "location_places" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_dataset" TEXT NOT NULL,
  "source_code" TEXT NOT NULL,
  "district_id" UUID NOT NULL,
  "subdistrict_id" UUID,
  "name" TEXT NOT NULL,
  "local_name" TEXT,
  "kind" "IndiaPlaceKind" NOT NULL,
  "source_type_label" TEXT,
  "source_updated_at" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "location_places_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "location_places_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "location_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "location_places_subdistrict_id_fkey" FOREIGN KEY ("subdistrict_id") REFERENCES "location_subdistricts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "location_places_source_dataset_source_code_key" ON "location_places"("source_dataset", "source_code");
CREATE INDEX "location_places_district_id_name_idx" ON "location_places"("district_id", "name");
CREATE INDEX "location_places_subdistrict_id_name_idx" ON "location_places"("subdistrict_id", "name");
CREATE INDEX "location_places_name_idx" ON "location_places"("name");
CREATE INDEX "location_places_kind_is_active_idx" ON "location_places"("kind", "is_active");

CREATE TABLE "location_import_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source" TEXT NOT NULL,
  "source_updated_at" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "states_inserted" INTEGER NOT NULL DEFAULT 0,
  "districts_inserted" INTEGER NOT NULL DEFAULT 0,
  "subdistricts_inserted" INTEGER NOT NULL DEFAULT 0,
  "places_inserted" INTEGER NOT NULL DEFAULT 0,
  "skipped_rows" INTEGER NOT NULL DEFAULT 0,
  "details" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "location_import_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "location_import_runs_source_started_at_idx" ON "location_import_runs"("source", "started_at");
