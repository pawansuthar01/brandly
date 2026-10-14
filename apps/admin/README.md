# Brandly Admin Portal

Responsive Next.js control center for the Brandly marketplace. Account, campaign, application, notification, theme, and app-settings data is loaded from the authenticated API and stored by the existing database.

## Run locally

From the repository root:

```bash
npm install
npm run dev --workspace @brandly/admin
```

Open `http://localhost:3001/admin/login`.

Use the configured admin credentials from the API environment. The admin UI does not ship demo sign-in accounts.

## Included modules

- Dashboard
- Users and profiles
- Campaigns
- Proposals
- Campaign-derived category usage (read-only)
- Android/iOS version settings
- Notification delivery logs

The local API runs on `http://localhost:3000`; the admin web runs on `http://localhost:3001`. Reports, reviews, support tickets, admin invites, and audit events are not exposed as operational pages because the current API schema has no persistent models for them. Campaign category counts are derived from saved campaigns and are not editable here.

The `/admin/themes` area is connected to the API and requires an API-issued admin bearer token. Its preview embeds the actual Expo Web export of the mobile app, so the screen selector and draft tokens control the same React Native components and theme resolver. Admin `dev` and `build` scripts export into a temporary directory, verify the HTML and referenced assets, then update only generated files under `public/mobile-preview`; no separate preview server is required. The preview is same-origin at `/mobile-preview/index.html`. Set `NEXT_PUBLIC_API_BASE_URL` if the API is not at `http://localhost:3000/v1`. Draft preview never publishes a theme, and preview data/actions are isolated from mobile user data.
