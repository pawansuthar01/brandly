# Mobile App

Expo + React Native application for Android and iOS.

Published appearance tokens are fetched from `GET /v1/app-themes/active` at launch and when the app returns to foreground. The app applies its last schema-validated AsyncStorage snapshot before rendering; without a snapshot or when offline/invalid it uses the bundled v1 theme. ETags avoid downloading unchanged snapshots. Only supported colors, type, spacing, radius, border, elevation, opacity, component and page tokens change remotely; routes and behavior stay bundled.

```text
app/              # Expo Router routes and layouts only
src/features/     # feature-specific screens, hooks, services, components
src/components/   # cross-feature reusable components
src/hooks/        # shared hooks
src/services/     # API client and device integrations
src/providers/    # auth, query, theme, and app providers
src/lib/          # helpers, validation, constants
src/styles/       # global reset and base styling only
```

Every screen owns a scoped `*.styles.ts` file. Reusable component styles stay with their component. Theme tokens are imported from `@brand-deals/theme`; no raw colors or gradients are allowed.
