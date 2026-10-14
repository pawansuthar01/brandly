# Shared Theme

Single source of truth for light/dark semantic tokens, typography, spacing, radii, shadows, and reusable component variants. Allowed palette: blue, white, neutral grays, and soft orange. Gradients are forbidden.

## Theme Studio registration

The runtime registry lives in `apps/api/src/modules/themes/theme-registry.ts`, a dependency-free module shared by API validation, the Admin editor, and mobile through `apps/mobile/src/lib/themeScreens.ts`.

To make an implemented screen themeable, add its stable ID, label, actual route keys, group, and supported audiences to `THEME_SCREENS`. The Admin selector and API/JSON validators derive their choices from this entry. Unspecified values inherit global styles. Groups with **All group pages, including future screens** enabled also apply their shared colors to new registry entries automatically. No database migration or full copied theme is needed. Implementing a new functional screen and its representative preview data still requires app code.

Inheritance is global tokens and components, then selected shared page-group colors, then page colors, then optional `tokens.pageComponents[screenId]` component fields. Only differing fields are stored. Reset removes overrides. Existing schema-v1 snapshots remain valid; the new fields are optional. Installed clients need this runtime support before these new scopes can be used remotely.

The read-only browser fixture can be run with `node --import tsx scripts/theme-studio-fixture.ts` from `apps/api`. It binds loopback port 3000, uses no database, returns the bundled default, and rejects save/publish/restore. Use it only when the real local API is stopped.
