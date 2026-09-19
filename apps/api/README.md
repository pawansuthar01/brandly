# API Backend

NestJS + Fastify backend. Routes/controllers stay thin; modules own business services, DTOs, persistence, and tests.

```text
src/common/       # config, database, guards, filters, rate limits, shared helpers
src/modules/      # domain modules only
src/workers/      # background queue processors
src/database/     # Prisma schema and migrations
```

All endpoints are under `/v1`, validated, authorized server-side, rate-limited centrally, and documented through OpenAPI.

## India location reference data

The repository did not previously contain a database schema or a running API package. The additive Prisma location schema in `prisma/schema.prisma` is the first database foundation for India discovery filters. It keeps LGD codes as source identifiers and uses foreign keys for every relationship:

```text
IndiaState / Union Territory
  -> IndiaDistrict
    -> IndiaSubdistrict (source parent code used for local-body reconciliation)
      -> IndiaPlace (city, town or urban local body)
```

Run the import only from a server/worker environment. Never ship `DATA_GOV_IN_API_KEY` in the mobile app.

```bash
cd apps/api
cp .env.example .env
# set DATABASE_URL and DATA_GOV_IN_API_KEY in .env
npm install
npm run db:generate
npm run db:migrate
npm run locations:sync
npm run locations:verify
```

`locations:sync` downloads the current official JSON API pages into the ignored `data/lgd/` cache and upserts them in dependency order. It is repeatable: state, district, sub-district, and place rows are keyed by LGD/source codes; missing rows are not deleted. Use `npm run locations:sync -- --refresh` to refresh the monthly source cache, or `--download-only` to download without touching the database.

The importer uses these official Open Government Data resources from the Ministry of Panchayati Raj: LGD States (`a71e60f0-a21d-43de-a6c5-fa5d21600cdb`), Districts (`37231365-78ba-44d5-ac22-3deec40b9197`), Sub-Districts (`6be51a29-876a-403a-a6da-42fde795e751`) and Local Bodies (`1a6c26ed-d67c-40ea-aa20-d38d35f341a5`). The LGD Village resource (`c967fe8f-69c4-42df-8afc-8a2c98057437`) is used only as a transient official code-to-district resolver for urban local-body rows covered by a village code; village rows are never inserted into `location_places` or shown in the product filter.

LGD is the official administrative/local-government directory; it does not define every informal neighbourhood name. The importer therefore preserves official urban local bodies as searchable city/town places and does not invent or infer locality records from names. Rural and village local-body rows are deliberately excluded.
