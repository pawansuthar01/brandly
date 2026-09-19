# Mobile App

Expo + React Native application for Android and iOS.

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
