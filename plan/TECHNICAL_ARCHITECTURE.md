# Technical Architecture Plan

## Chosen Stack

| Area | Chosen technology | Purpose |
| --- | --- | --- |
| Repository | pnpm + Turborepo monorepo | Shared types, theme, UI rules, and coordinated releases |
| Mobile app | Expo + React Native + TypeScript | One maintained app codebase for Android and iOS |
| Navigation | Expo Router | Typed, file-based mobile navigation |
| App state/data | TanStack Query + feature hooks | API cache, loading/error/mutation handling outside pages |
| Styling | React Native `StyleSheet` files + custom ThemeProvider | Scoped page/component styles with centralized tokens and light/dark mode |
| Admin portal | Next.js + TypeScript | Browser dashboard for moderation, verification, categories, reports, and version settings |
| API backend | NestJS + Fastify + TypeScript | Modular REST API, authorization, validation, jobs, WebSockets, and OpenAPI docs |
| Database | PostgreSQL on AWS RDS, Mumbai region | Primary relational database with transactions and strong search/filter support |
| ORM/migrations | Prisma | Typed database access and reviewed, versioned migrations |
| Cache/queues/rate limit | Redis on AWS ElastiCache | Central rate limits, cache, background job queues, OTP counters, and anti-spam controls |
| File storage | AWS S3, Mumbai region + CloudFront CDN | Profile photos, portfolio media, campaign assets, and verification evidence |
| Realtime | Socket.IO through NestJS + Redis adapter | Private chat, typing indicators, read states, and live notifications |
| Push notifications | Expo Notifications with FCM/APNs | Android and iOS push delivery |
| OTP | MSG91 | India-first mobile OTP delivery |
| Email | Resend | Transactional verification and notification emails |
| Monitoring | Sentry + AWS CloudWatch | Crash/error monitoring, API logs, alerts, and performance tracking |
| CI/CD | GitHub Actions + EAS Build/Submit + AWS deployment | Tested mobile builds and controlled API/admin releases |

## Repository and Frontend Structure

```text
apps/
  mobile/                 # Expo Android/iOS app
  api/                    # NestJS API
  admin/                  # Next.js admin portal
packages/
  ui/                     # shared mobile UI primitives and composed reusable components
  theme/                  # one source of truth for design tokens and light/dark themes
  types/                  # shared API/domain types
  api-client/             # generated/typed API client used by mobile and admin
  config/                 # shared lint, TypeScript, testing configuration
```

### Mobile application rules

- Screen files compose reusable components and call feature hooks only; they never call `fetch`, Axios, or the HTTP client directly.
- Feature flow is fixed: `screen → feature hook → service/API client → NestJS API`.
- Every screen has its own scoped `*.styles.ts` file. Shared components have their own scoped styles. Home and dashboard styles are isolated from all other screens.
- `packages/theme` owns semantic tokens for color, typography, spacing, radii, shadows, and component variants. It exposes the same semantic token names for light and dark mode.
- No gradients. The only allowed palette families are blue, white, neutral gray, and soft orange; components use semantic tokens, never literal colors.
- A shared component is mandatory for repeated UI: buttons, inputs, cards, filters, lists, empty states, loaders, modals, headers, badges, avatars, and feedback/rating displays.

## Backend Architecture

Build the API as a modular monolith first. It remains easy to deploy and test, while each module has clear boundaries for future extraction if scale requires it.

```text
Mobile App / Admin Portal
        │ HTTPS + JWT
        ▼
NestJS API (AWS Mumbai)
  Auth │ Profiles │ Social Accounts │ Campaigns │ Proposals
  Chat │ Reviews │ Search │ Moderation │ Notifications │ App Config
        │              │                  │
        ▼              ▼                  ▼
 PostgreSQL          Redis              S3 + CloudFront
 primary data     cache/queues       files and media
```

### Backend module responsibilities

- **Auth:** mobile OTP, email verification, token refresh/revocation, devices/sessions, role selection, account suspension.
- **Users and profiles:** influencer and brand profile creation, privacy, portfolio, service area, languages, availability, audience metrics, and public-safe profile views.
- **Social accounts:** influencer Instagram and YouTube links, declared audience metrics, and safe public display. No strict KYC or automated verification workflow in V1; admins can review reports and suspend suspicious accounts.
- **Campaigns:** brand brief creation, draft/publish/archive status, category/location/budget targeting, safe search and pagination.
- **Discovery/matching:** database-backed filters and ranking by relevance, category, location, platform, audience, engagement, budget, verification, rating, and activity.
- **Proposals:** proposal, counter-offer, accept, decline, withdraw, complete, cancel, dispute, and immutable status history. Contact data is released only after acceptance and explicit influencer consent for the selected contact method.
- **Chat:** create chat only for accepted proposals; authorized participants only; message persistence, read status, attachments, spam controls, and real-time events.
- **Reviews:** one review per party only after a completed proposal; editable only during a short configured period; report, hide, and moderation workflow.
- **Moderation:** reports, block lists, verification review, content removals, suspensions, audit logs, and admin roles.
- **Notifications:** in-app, push, and email events handled asynchronously through Redis-backed jobs.
- **App configuration:** version/update policy for Android and iOS, feature flags, category management, and platform settings.

## Database Plan

Use PostgreSQL because this marketplace needs reliable relationships and transactions: users, roles, campaigns, proposals, chat permissions, reviews, reports, and audit history. Enable PostGIS for city/state coordinates and radius/location search.

### Core tables

- `users`, `user_sessions`, `roles`, `user_roles`, `devices`
- `influencer_profiles`, `brand_profiles`, `portfolio_items`, `categories`, `profile_categories`, `languages`, `profile_languages`
- `social_accounts`, `social_account_metrics`
- `campaigns`, `campaign_categories`, `campaign_locations`, `campaign_requirements`
- `proposals`, `proposal_deliverables`, `proposal_status_history`, `contact_release_records`
- `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_reads`
- `reviews`, `review_reports`, `reports`, `blocks`, `moderation_actions`, `audit_logs`
- `notifications`, `push_tokens`, `app_version_configs`, `feature_flags`

### Data rules

- Store money as integer paise, currency as `INR`, and price visibility as `public_range` or `private_quote`.
- Use UUID primary keys, created/updated timestamps, soft-delete fields where moderation/audit recovery is needed, and database foreign keys for ownership integrity.
- Keep personal contact details private in protected fields. Public search queries never return phone, email, OTP data, tokens, or verification evidence.
- Add indexes for public search fields: role, profile status, verified state, category, platform, city/state, audience range, price range, rating, campaign status, and creation/activity time.
- Store media in S3, not in PostgreSQL; the database contains metadata and access controls only.
- Add `contact_share_consents` to record which contact method an influencer approved for each accepted proposal.
- Add `legal_acceptances` to record accepted Terms/Privacy versions and use an 18+ age gate during registration.

## API, Security, and Operations

- REST API versioned under `/v1`; NestJS generates OpenAPI/Swagger documentation. Mobile and admin use the typed API client generated from that contract.
- JWT access token is short-lived; refresh token is rotated and stored securely. Store mobile tokens in secure device storage, never ordinary app storage.
- All protected endpoints enforce authentication, role, resource ownership, account status, and proposal/chat participant access on the server.
- Validate every request with DTO schemas; sanitize rich text, validate uploads by MIME/type/size, scan files before release, and use signed S3 upload/download URLs.
- Central Redis rate limits: strict limits for OTP, login, verification, messaging, proposal/contact requests, reviews, reports, search, and uploads. Return consistent `429` responses with retry information.
- Use background jobs for notification delivery, media processing, expiry/cleanup jobs, social metric refresh, and audit-safe retry handling.
- Back up PostgreSQL daily with point-in-time recovery; use encrypted storage, secrets manager, HTTPS everywhere, separate development/staging/production environments, and least-privilege access.
- Use Sentry for mobile/API/admin errors, CloudWatch for infrastructure logs/alerts, and health checks for API, Redis, database, and queue workers.

## App Update and Release System

- The admin portal manages an `app_version_configs` record per platform: `minimumSupportedVersion`, `latestVersion`, `updateType`, `message`, `releaseNotes`, and store URL.
- Mobile app checks this config on launch and app resume, caches the last valid response, and handles three outcomes: current, optional update, mandatory update.
- Mandatory update blocks protected app usage and opens Google Play/App Store; optional update remains dismissible. Invalid or unavailable config never blocks the app unless a previously cached mandatory rule is valid.
- Version all mobile builds and API contracts. CI requires linting, unit tests, integration tests, and API-contract checks before staging; production is promoted only after staging verification.

## Store Approval and Compliance Plan

The goal is to make the first submission review-ready. Store approval cannot be guaranteed, because Apple and Google make the final review decision; the following controls minimize preventable rejection risk.

### Product safeguards

- Public profiles and campaign discovery are available without login where possible. Sign-in is required only for protected actions: creating content, proposals, chat, reviews, saved items, or released contact details.
- Use mobile OTP/email for primary app access. Instagram and YouTube links are public profile fields only in V1, not login methods and not automatic verification.
- Account Settings includes a clear **Delete account and data** action. A public website deletion-request page is also published. The deletion flow removes personal data and user-generated content unless a disclosed legal retention requirement applies.
- Ask permissions only just in time: media/camera while uploading, notifications after explaining their value, and precise location only for a nearby search. City/state manual selection always works without location permission.
- Build report/block/moderation into profiles, campaigns, portfolio media, chat, and reviews. Admins can act on reports and every action is retained in the audit log.
- Provide Privacy Policy, Terms of Service, Community Guidelines, and support pages in the app, website, and store metadata. Their disclosures must match all actual API, analytics, notification, storage, OTP, and social-verification behavior.

### Submission package

- Create production reviewer accounts for both roles with safe, realistic test data: an influencer with verified/unverified social examples, a brand campaign, a proposal, accepted collaboration, chat, and review pathway.
- Give Apple clear App Review notes: demo credentials, how to bypass OTP for the review account, key feature paths, moderation contact, and any required configuration. Maintain equivalent Play Console testing instructions.
- Submit only accurate screenshots, descriptions, feature claims, age rating, privacy labels/Data Safety form, permissions, support URL, and privacy-policy URL. Re-check all third-party SDK data behavior before completing declarations.
- Use release builds on physical iOS and Android devices for final acceptance testing; no mock-only, incomplete, or placeholder flows are permitted in the submitted binary.
- Re-check the current Android target API requirement immediately before production build creation and use the currently supported Xcode/iOS SDK toolchain.

### Mandatory pre-submission gate

1. Run unit, integration, API-contract, and end-to-end tests for auth, deletion, discovery, proposal, contact release, chat, review, report/block, and version update flows.
2. Complete manual device testing for permission denial, poor/offline network, account deletion, deep links, push notifications, error states, and accessibility.
3. Confirm no gradients, fake social verification, platform-endorsement claims, guaranteed-result claims, undeclared data collection, or unauthorized contact-data exposure exists.
4. Conduct a release-compliance review against the latest Apple App Review Guidelines and Google Play policy/forms, then retain its signed checklist with the release record.

## Delivery Phases

1. **Foundation:** monorepo, themes, reusable UI system, mobile/admin/API scaffolding, environments, CI, PostgreSQL/Redis/S3, observability.
2. **Identity and profiles:** OTP/email auth, roles, 18+ legal acceptance, influencer/brand onboarding, profile completion, media uploads, Instagram/YouTube profile links.
3. **Marketplace:** categories, campaigns, discovery filters, ranking, public price ranges, saved searches.
4. **Collaboration:** proposals/counter-offers, influencer-approved contact release, private chat, deal completion/cancellation/dispute, notifications.
5. **Trust and operations:** reviews, reports, blocks, admin moderation, rate limits, audit logs, version/update system.
6. **Hardening and release:** full testing, security review, performance/load testing, store builds, privacy policy/terms, staged India launch.

## Acceptance Tests

- One Expo codebase produces functioning Android and iOS builds with light/dark mode and no gradients/raw color values.
- Changing a theme token changes every relevant shared component; changing a home/dashboard style file does not affect other screens.
- Pages do not directly call APIs; hooks, services, controllers, and typed API contracts are used end-to-end.
- Brand and influencer can complete onboarding, publish/search relevant data, propose/counter/accept, chat only after acceptance, and then access verified contact details.
- Instagram/YouTube profile links display safely without a strict verification badge; user/role/ownership checks prevent unauthorized data access and admins can suspend suspicious accounts.
- A review cannot be created until the related proposal is completed; contact data is exposed only for the method explicitly approved by the influencer.
- Rate limits, validation, reports, blocking, notifications, backups, logs, and mandatory/optional update flows behave as specified.
- Validate store-release compliance: in-app and web account deletion, permission-denied alternatives, public legal/support links, moderator response flow, reviewer demo accounts, truthful metadata, and accurate privacy/Data Safety declarations.
