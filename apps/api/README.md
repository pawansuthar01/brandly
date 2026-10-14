# API Backend

NestJS + Fastify backend foundation. Routes/controllers stay thin; domain
modules own business services, DTOs, persistence, and tests.

```text
src/common/       # config, database, guards, filters, rate limits, shared helpers
src/modules/      # domain modules only
src/workers/      # background queue processors
src/database/     # Prisma schema and migrations
```

The current setup includes the first production domain slice:

- `POST /v1/auth/otp/request` and `/v1/auth/otp/verify` for WhatsApp OTP auth
- refresh-token rotation, `/v1/auth/me`, and logout
- authenticated profile/onboarding and social-account verification requests
- Redis-backed public social-profile sync with stored display name, audience counts,
  profile image, metadata, verification state, retry state, and scheduled refresh
- persisted push/WhatsApp notification registration and inbox records
- admin-only WhatsApp delivery settings and content-verification review

## Run locally

```bash
cd apps/api
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run start:dev
```

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- OpenAPI: `GET /docs` when `SWAGGER_ENABLED=true`
- Domain route prefix: `/v1`

WhatsApp credentials are never shipped to the mobile bundle and are not read
from a mobile `.env` file. The API accepts server-only `WHATSAPP_*` environment
variables as its bootstrap configuration. An authenticated `ADMIN` account can
override those values through `/v1/admin/settings/whatsapp`; the API stores the
override encrypted in `app_settings`. The API encryption key must be injected
as `APP_CONFIG_ENCRYPTION_KEY` by the server's secret manager/process
supervisor (do not commit it or place it in the mobile app). The provider is
used through `POST https://wa-api.suthartech.com/api/messages/send` for OTP
and optional WhatsApp notification delivery.

The social sync worker reads only allowlisted HTTPS public profile pages. It
never stores raw HTML; blocked or JavaScript-only pages remain `FAILED`/
`PENDING` for retry or manual review. Public-profile name matching is a
best-effort automatic check, not OAuth ownership proof.

The bootstrap applies strict request validation, bounded request bodies,
security headers, explicit CORS origins, request IDs, compression, and shared
Redis-backed rate limiting when `REDIS_URL` is available. Production startup
requires database, Redis, and JWT secret configuration. Deploy the social-sync
migration with `npm run db:migrate` before starting the API. No security setup
can honestly guarantee absolute security, so
authentication, authorization, audit logging, file scanning, and domain DTOs
must be completed before exposing business endpoints publicly.

## India location reference data

The additive Prisma location schema in `src/database/schema.prisma` is the
database foundation for India discovery filters. It keeps LGD codes as source
identifiers and uses foreign keys for every relationship:

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

## App themes

`GET /v1/app-themes/active` is public read-only and returns the active complete v1 mobile theme with an ETag. Admin-only `/v1/admin/themes/drafts`, `/versions`, and `/activations` endpoints support draft editing, immutable snapshots, paginated history/audit, publishing, and restoring. Every write requires an `ADMIN` bearer token. Run `npm run db:generate` and `npm run db:migrate` in this workspace to apply the additive theme tables. Publish and restore update the active pointer and append an actor/timestamp activation event in one Prisma transaction.
