# Project Engineering Rules

These rules are mandatory for every agent and developer working in this repository. Before starting any task, inspect the existing structure and extend it consistently.

## 1. Reusable-first UI

- Do not create one-off UI that can reasonably be reused.
- Cards, buttons, inputs, modals, badges, lists, empty states, loaders, headers, filters, and form fields must be shared components when used or likely to be used across screens.
- Keep page/screen files focused on composition and page-specific state; do not put large UI component implementations inside pages.
- Use shared design tokens for colors, spacing, typography, borders, shadows, breakpoints, and component variants. Do not hard-code inconsistent styles in individual screens.
- A component must accept clear props and support the variants required by its consumers instead of duplicating near-identical components.

## 2. Design system and styling rules

- Use a minimal, professional visual system only. Do not use gradients anywhere: no gradient backgrounds, text, borders, buttons, cards, or decorative effects.
- The approved V1 palette is blue, white, neutral grays, and a soft orange accent. Do not introduce arbitrary colors.
- All colors must use semantic design tokens; never write literal color values in a page, component, or feature stylesheet.
- Use semantic tokens such as `background`, `surface`, `textPrimary`, `textSecondary`, `border`, `primary`, `primaryText`, `accent`, `danger`, and `success`. Components must not choose their own text or button colors.
- Support light and dark mode from day one. Both themes implement the same semantic token names, so changing the active theme updates the complete app consistently.
- Keep the complete shared theme in one source of truth (for example `src/styles/theme/tokens.*`): colors, typography, font families, font sizes, font weights, spacing, radii, shadows, breakpoints, and component variants.
- Any global brand change—button style, text style, font, color, spacing, radius, or dark/light theme behavior—must be possible through this central theme/configuration layer without editing every page.
- Keep global CSS limited to resets, base typography, theme variables, and truly global utilities. Do not put page-specific CSS in global files.
- Each page/screen must have its own scoped style file/module. Home and dashboard must also have independent scoped styles so either can be redesigned without changing other pages.
- Shared components own their own scoped styles and consume shared theme tokens. A page must not override a shared component with copied inline styles; add a documented component variant when a reusable variation is needed.
- Avoid inline styles except for values that are genuinely dynamic at runtime and cannot be expressed through tokenized variants.

## 3. App version and update policy

- Implement a centralized remote app-version configuration, managed by the backend/admin system; do not hard-code release rules inside individual screens.
- On app launch and resume, check the current platform version against the server configuration.
- Support three states: no update, optional update (dismissible prompt), and mandatory update (blocks app use and opens the relevant App Store/Google Play update page).
- The configuration must be platform-aware (Android/iOS) and include minimum supported version, latest version, update message, release notes, and store URL.
- Cache the most recent successful version configuration for offline resilience, and fail safely without blocking users if an optional update check is unavailable.

## 4. Required project structure

Organize code by feature/domain while keeping shared code centralized:

```text
src/
  app/            # app bootstrap, routes, providers, configuration
  features/       # domain modules: auth, profiles, campaigns, proposals, chat, reviews
  components/     # reusable cross-feature UI components
  hooks/          # reusable cross-feature hooks
  services/       # API clients and external integrations
  controllers/    # request/orchestration layer where applicable
  lib/            # shared utilities, validation, constants, helpers
  types/          # shared TypeScript types
  styles/         # theme tokens, light/dark themes, global CSS, shared style utilities
```

- Each feature may contain its own `components`, `hooks`, `services`, `types`, and tests when they are not shared outside that feature.
- Do not create duplicate utilities, types, API clients, or UI components. Search the repository before adding one.

## 5. Data and API boundaries

- Never call `fetch`, Axios, or any HTTP client directly from a page/screen or presentational component.
- Pages/screens call feature hooks only. Hooks manage loading, error, caching, and mutation state.
- Hooks call services. Services contain all API endpoint, request, response, authentication, and serialization logic.
- Controllers/orchestrators handle multi-step business workflows and coordination; UI must not contain business rules or API orchestration.
- Use typed request/response models and centralized error handling. Do not use untyped `any` for API data.
- Keep secrets, API base URLs, and environment-specific configuration outside UI code.

## 6. Backend and end-to-end quality

- Keep routes/controllers thin; move business logic into services/use-cases and keep persistence/data-access isolated.
- Validate every external input on the server. Enforce authentication and role/ownership authorization on every protected action.
- Return consistent API response and error formats.
- Add pagination, filtering, sorting, and safe limits for list/search endpoints.
- Log meaningful server errors without exposing private data to users.
- For each feature, cover the complete path: UI state, hook, service/API, authorization, validation, errors, loading states, empty states, and success feedback.

## 7. Rate limiting and protection

- Apply centralized server-side rate limiting; never rely on client-side limits for security.
- Use stricter limits for OTP/authentication, password/reset actions, social-account verification, messages, contact requests, reviews, reports, search, and file uploads.
- Rate-limit by authenticated user and IP where appropriate; return a standard `429 Too Many Requests` response with retry guidance.
- Add abuse protection for duplicate proposals, spam messages, repeated contact requests, and automated account creation.

## 8. Delivery checklist

- Reuse existing components, hooks, services, types, styles, and helpers before adding new ones.
- Add or update tests for shared logic, services/controllers, and important user flows.
- Confirm responsive behavior, accessibility labels, loading/error/empty states, and authorization failures.
- Confirm light and dark mode on every screen; verify no gradients, raw colors, or one-off component styling are introduced.
- Verify a global theme-token change updates all consumers and a home/dashboard scoped-style change does not affect unrelated screens.
- Test the app-version API for current, optional-update, mandatory-update, malformed-config, and offline cases.
- Do not leave dead code, duplicate components, direct page-level API calls, or feature-specific hard-coded styling that belongs in shared tokens/components.

## 9. App Store and Google Play release compliance

- Treat every release as store-review ready. No feature may be submitted incomplete, hidden behind a broken flow, dependent on mock data, or presented with misleading claims.
- First-time approval cannot be guaranteed because Apple and Google make the final decision; however, every build must pass this checklist before submission.
- Provide public, accurate Privacy Policy, Terms of Service, Community Guidelines, and support/contact pages. Keep their data-collection, sharing, retention, deletion, moderation, and contact-sharing statements consistent with the actual app and third-party SDKs.
- Provide in-app account deletion in Account Settings. Also provide a public web page for account/data-deletion requests. Explain any legally required retention clearly.
- Allow public discovery/browsing without an account where practical. Require authentication only for account-specific actions such as posting, proposing, messaging, saving, reviewing, or viewing released contact details.
- Use phone OTP and email as the primary sign-in system. Do not add social login for primary app access unless the required platform-compliant alternatives are implemented. Social OAuth is only for verifying an influencer-owned social account.
- Ask for device permissions only when the user invokes the related feature: camera/media for uploading an image, notifications after a clear benefit is shown, and precise location only for an explicitly requested nearby search. Always provide a manual city/state alternative when location is denied.
- Every sensitive permission must have a clear, truthful, user-facing purpose description. Do not require notification, tracking, location, contacts, microphone, or unrelated permissions to use the core app.
- App Tracking Transparency is required before tracking Apple users across apps/websites. Do not implement tracking/advertising SDKs unless their consent, disclosure, and store-form requirements are fully completed.
- User-generated content (profiles, portfolios, campaigns, chat, reviews) must include report, block, moderation, escalation, and removal capabilities. Admin actions must be auditable.
- Do not display social platform branding, audience metrics, verification badges, or partnership claims in a way that suggests endorsement by a social platform. Verified means only that the linked account ownership was validated by the app's documented method.
- Do not claim guaranteed collaborations, followers, reach, earnings, or campaign results. Make all marketplace descriptions and pricing clearly user-provided or estimated where applicable.
- Prepare reviewer access before submission: valid demo brand account, valid demo influencer account, OTP-free review access or clear test instructions, populated safe sample data, testable chat/proposal flow, support contact, and concise review notes.
- Store metadata must match the shipped app exactly: name, description, keywords, age rating, screenshots, privacy/data-safety forms, permissions, URL links, and support details. Never use placeholder metadata or screenshots of unavailable features.
- Target the latest store-required Android API level at release time; re-check this requirement immediately before generating the production Android build.
- Before submitting, test release builds—not development builds—on physical Android and iOS devices; verify crash-free launch, sign-in, account deletion, permission-denied paths, offline states, deep links, push notifications, and all legal links.
