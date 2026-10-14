# Reminder audit

The alarm is scheduled locally with expo-notifications. The API stores task/reminder state and inbox metadata; its worker does not deliver competing push, email, or WhatsApp alarms.

## Root causes corrected

- Each task created multiple notifications: early, due, retry and automatic snooze.
- Startup deleted native alarms; process-local maps and stale IDs were treated as schedule authority.
- Foreground and background Snooze/Stop paths competed and lost action state on restart.
- Android silently fell back to inexact alarms without special access.
- iOS lacked native notification-action handling independent of React startup.
- Refreshes and delayed work could undo offline actions or rearm alarms after logout.
- Remote tasks were memory-only and calendar date-range loading missed reminders.
- Creation retries lacked idempotency; concurrent API updates could read stale completion state.
- Date fields lost the year, numeric-month parsing failed, and past dates silently rolled forward a year.
- Task deletion was not connected to alarm cancellation.
- Item vibration preferences were not persisted; Snooze always used five minutes.
- Server fallback could send emails/WhatsApp to logged-out users.

## Resulting behavior

One native date trigger per reminder, identified by stable reminder/task IDs. Edits replace schedules; deletion/completion/logout cancel them. Native pending schedules are reconciled instead of blindly recreating alarms. The durable action journal uses AsyncStorage on Android and UserDefaults for native iOS actions. Android uses Expo's notification background task; iOS uses a local Expo module that retains Expo's delegate for other notifications.

Account-scoped cache and Redux preferences preserve reminders/settings. Conditional API synchronization prevents stale offline actions from overriding newer edits. Permission, exact-access, blocked-channel and notification-limit failures surface errors. Absolute timestamps retain the chosen instant across timezone changes; displayed times use the current timezone. Nonexistent DST local times are rejected. Snooze can be configured to five, ten or fifteen minutes.

## Verification

    npm run test:reminders --workspace @brand-deals/mobile
    npm run test:reminders --workspace @brand-deals/api

Tests execute actual TypeScript services with mocked OS/storage/database adapters. They cover lifecycle, concurrent reconciliation, JS reloads, stale snapshots/actions, logout, deletion, permissions, exact access, timezone/DST, idempotency, ownership and dates. They do not prove physical OS delivery or database transaction isolation.

Mobile typecheck, API compilation, Android native-module compilation and Android/iOS JS bundle export were checked. iOS Swift compilation requires Xcode and was not run on Windows.

## Validation limits

A native development/production build is required; Expo Go cannot verify the local module. No app was installed, released or deployed. Per the revised user scope, physical-device, locked-screen, reboot and notification-button tests were not run.

Android force-stop differs from closing/swiping away the app: the OS can suppress alarms until reopening. Permissions/device restrictions still apply, so zero delivery latency under every condition cannot be guaranteed by application code. Expo's existing boot receiver restores pending Android schedules after reboot.

Documentation:
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://developer.android.com/develop/background-work/services/alarms
- https://developer.apple.com/documentation/usernotifications/handling-notifications-and-notification-related-actions
