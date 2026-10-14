import assert from "node:assert/strict";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { defaultTheme, validateTheme } from "../src/modules/themes/theme-schema.js";
import { themePages } from "../src/modules/themes/theme-schema.js";
import { AdminThemesController } from "../src/modules/themes/themes.controller.js";
import { ThemesService } from "../src/modules/themes/themes.service.js";
import { chooseValidTheme, isValidTheme, resolveThemeColors, resolveThemeComponents, resolveThemeContent, type ThemeDocument } from "../../mobile/src/lib/themeValidation.js";
import { createThemeRefresher } from "../../mobile/src/services/themeRefresh.js";
import { exportThemeJson, parseThemeJson, themeContrastWarning, updateTypographyToken } from "../../admin/src/lib/themeJson.js";
import { THEME_SCREENS, themeScreenForRoute } from "../../mobile/src/lib/themeScreens.js";
import { resolveThemePalette } from "../../mobile/src/lib/themePalette.js";
import { applyThemePreset } from "../../admin/src/lib/applyThemePreset.js";

function rejected(input: unknown) { assert.throws(() => validateTheme(input)); }
const theme = structuredClone(defaultTheme);
assert.deepEqual(validateTheme(theme), theme);
assert.equal(themeContrastWarning(theme), '', 'the bundled baseline does not show a false contrast warning on editor load');
const lowContrastTheme = structuredClone(theme);
lowContrastTheme.tokens.colors.light.text = '#F0F0F0';
assert.equal(isValidTheme(lowContrastTheme), false, 'live themes still reject unreadable text colors');
assert.equal(isValidTheme(lowContrastTheme, { allowLowContrast: true }), true, 'the private draft preview accepts valid colors while warning about contrast');
assert.deepEqual(validateTheme(lowContrastTheme, { allowLowContrast: true }), lowContrastTheme, 'API draft validation accepts low contrast without relaxing token validation');
assert.throws(() => validateTheme(lowContrastTheme), /contrast/i, 'publish validation keeps the readability guard');
assert.deepEqual(parseThemeJson(exportThemeJson(lowContrastTheme)), lowContrastTheme, 'JSON import can save a low-contrast draft for preview');
assert.match(themeContrastWarning(lowContrastTheme), /theme\.tokens\.colors\.light\.text.*4\.5:1 contrast/i, 'the editor identifies the low-contrast field and explains the threshold');
const lowContrastCard = structuredClone(theme);
lowContrastCard.tokens.components.card = { backgroundSky: '#777777' };
assert.match(themeContrastWarning(lowContrastCard), /theme\.tokens\.components\.card\.backgroundSky.*4\.5:1 text contrast/i, 'component contrast warnings identify each card surface token');
const lowContrastPageCard = structuredClone(theme);
lowContrastPageCard.tokens.pageComponents = { home: { card: { backgroundSky: '#777777' } } };
assert.match(themeContrastWarning(lowContrastPageCard), /theme\.tokens\.pageComponents\.home\.card\.backgroundSky.*4\.5:1 text contrast/i, 'page component warnings identify the scoped card surface');
const largerDisplay = updateTypographyToken(theme, 'display', 'size', 42);
assert.deepEqual([largerDisplay.tokens.typography.display.size, largerDisplay.tokens.typography.display.lineHeight], [42, 42], 'font size edits keep line height valid so the preview does not freeze');
assert.equal(isValidTheme(largerDisplay), true, 'a typography edit remains previewable as one valid update');
assert.equal(updateTypographyToken(largerDisplay, 'display', 'lineHeight', 20).tokens.typography.display.lineHeight, 42, 'line-height edits cannot make the selected font token invalid');
const invalidLowContrastDraft = structuredClone(lowContrastTheme);
invalidLowContrastDraft.tokens.spacing.md = 999;
assert.equal(isValidTheme(invalidLowContrastDraft, { allowLowContrast: true }), false, 'draft preview does not relax numeric bounds');
const lowContrastDraftService = new ThemesService({ appThemeDraft: { create: async ({ data }: { data: Record<string, unknown> }) => data } } as never);
const persistedLowContrastDraft = await lowContrastDraftService.createDraft('admin:owner', { theme: lowContrastTheme });
assert.deepEqual(persistedLowContrastDraft.document, lowContrastTheme, 'admin can persist a private low-contrast draft before correcting it for publish');
const presetSource = structuredClone(theme);
presetSource.tokens.components = { button: { background: '#AABBCC', radius: 30 }, card: { background: '#DDEEFF', radius: 34 } };
presetSource.tokens.pages.home = { surface: '#CCDDEE' };
presetSource.tokens.pageComponents = { home: { card: { background: '#CCDDEE' } } };
presetSource.tokens.pageGroups = { commerce: { pages: ['home'], colors: { surface: '#CCDDEE' } } };
const appliedPreset = applyThemePreset(presetSource, {
  name: 'White card preset',
  light: { primary: '#5C5FC1', surface: '#FAFDFE' },
  dark: { primary: '#BBA8FF', surface: '#211D2C' },
  components: { card: { backgroundHero: '#F2F7FE' } },
  gradients: { light: { top: '#E9EEFB', right: '#E2EEF8', bottom: '#E5EFF9', left: '#DBECF3' }, dark: { top: '#16141D', right: '#1C2432', bottom: '#182B31', left: '#20253B' } },
});
assert.deepEqual(appliedPreset.tokens.components, { card: { backgroundHero: '#F2F7FE' } }, 'a preset replaces stale component overrides instead of merging partial fields');
assert.deepEqual(appliedPreset.tokens.pages, {}, 'a preset removes page color overrides');
assert.deepEqual(appliedPreset.tokens.pageComponents, {}, 'a preset removes stale page component overrides');
assert.deepEqual(appliedPreset.tokens.pageGroups?.commerce, { pages: ['home'], colors: {} }, 'preset application preserves shared page assignment but clears old group colors');
assert.equal(appliedPreset.tokens.colors.light.surface, '#FAFDFE', 'the light preset card surface matches the supplied soft white');
assert.deepEqual(presetSource.tokens.components.card, { background: '#DDEEFF', radius: 34 }, 'applying a preset does not mutate the source theme');
const noGradientPreset = applyThemePreset(appliedPreset, { name: 'No gradient preset', light: { primary: '#112233' }, dark: { primary: '#445566' }, components: {} });
assert.equal(noGradientPreset.tokens.gradients, undefined, 'presets without gradients clear a previous preset gradient');
assert.equal(isValidTheme(theme), true);
const contentTheme = { ...structuredClone(theme), content: { 'home.brand.heading': 'Find thoughtful creator partners.' } };
assert.deepEqual(validateTheme(contentTheme), contentTheme, 'safe app copy is stored as a separate document field');
assert.equal(isValidTheme(contentTheme), true, 'mobile accepts registered content overrides');
assert.equal(resolveThemeContent(contentTheme, 'home.brand.heading', 'Bundled heading'), 'Find thoughtful creator partners.');
assert.equal(resolveThemeContent(theme, 'home.brand.heading', 'Bundled heading'), 'Bundled heading', 'older themes keep the bundled copy fallback');
assert.deepEqual(parseThemeJson(exportThemeJson(contentTheme)), contentTheme, 'JSON import/export preserves editable app copy');
rejected({ ...theme, content: { 'home.brand.heading': '<script>alert(1)</script>' } });
rejected({ ...theme, content: { 'home.brand.heading': 'x'.repeat(81) } });
rejected({ ...theme, content: { 'home.unknown.label': 'unsupported key' } });
assert.deepEqual([...themePages].sort(), THEME_SCREENS.map((item) => item.id).sort(), "API validation IDs match the mobile preview screen registry");
assert.ok(THEME_SCREENS.every((screen) => screen.audiences.length > 0 && screen.audiences.every((side) => side === "brand" || side === "creator")), "every preview screen is assigned to a supported side");
assert.ok(THEME_SCREENS.filter((screen) => screen.audiences.some((side) => side === "creator")).some((screen) => screen.id === "studio"), "creator selector includes creator workspace pages");
assert.equal(THEME_SCREENS.find((screen) => screen.id === "budget")?.audiences.some((side) => (side as string) === "creator"), false, "creator selector hides brand-only budget page");
for (const screen of THEME_SCREENS) for (const route of screen.routes) assert.equal(themeScreenForRoute(route), screen.id, 'registry connects each actual route to its theme scope');
assert.equal(themeScreenForRoute('detail:unknown'), undefined);
const groupedTheme = structuredClone(theme);
groupedTheme.tokens.pageGroups = { commerce: { pages: ["home", "marketplace"], colors: { primary: "#5C5FC1" } } };
assert.deepEqual(validateTheme(groupedTheme), groupedTheme, "shared groups validate and persist with page assignments");
assert.equal(resolveThemeColors(groupedTheme, "light", "home").primary, "#5C5FC1", "shared theme applies to every assigned page");
groupedTheme.tokens.pages.home = { primary: "#222222" };
assert.equal(resolveThemeColors(groupedTheme, "light", "home").primary, "#222222", "individual page override takes precedence over its shared group");
assert.equal(resolveThemeColors(groupedTheme, "light", "marketplace").primary, "#5C5FC1", "page override does not leak to other shared pages");
const registryGroupTheme = structuredClone(theme);
registryGroupTheme.tokens.pageGroups = { commerce: { pages: [], colors: { primary: '#114477' }, followRegistry: true } };
assert.deepEqual(validateTheme(registryGroupTheme), registryGroupTheme);
assert.equal(isValidTheme(registryGroupTheme), true);
assert.deepEqual(parseThemeJson(exportThemeJson(registryGroupTheme)), registryGroupTheme);
for (const screen of THEME_SCREENS) assert.equal(resolveThemeColors(registryGroupTheme, 'light', screen.id).primary, screen.group === 'commerce' ? '#114477' : theme.tokens.colors.light.primary, 'registry group inherits without storing every page ID');
registryGroupTheme.tokens.pages.home = { primary: '#222222' };
assert.equal(resolveThemeColors(registryGroupTheme, 'light', 'home').primary, '#222222');
delete registryGroupTheme.tokens.pages.home;
assert.equal(resolveThemeColors(registryGroupTheme, 'light', 'home').primary, '#114477');
assert.equal(resolveThemeComponents(registryGroupTheme, 'home').button.background, '#114477', 'shared semantic color reaches real shared buttons');
const scopedComponents = structuredClone(theme);
scopedComponents.tokens.components = { card: { radius: 20, background: '#EDF5FF' }, button: { radius: 16 } };
scopedComponents.tokens.pageComponents = { home: { card: { radius: 32 }, button: { radius: 24 } } };
assert.deepEqual(validateTheme(scopedComponents), scopedComponents, 'API accepts page component overrides');
assert.equal(isValidTheme(scopedComponents), true, 'mobile accepts the same page component schema');
assert.deepEqual(parseThemeJson(exportThemeJson(scopedComponents)), scopedComponents, 'page component JSON round-trip');
assert.equal(resolveThemeComponents(scopedComponents, 'home').card.radius, 32, 'page overrides shared component');
assert.equal(resolveThemeComponents(scopedComponents, 'home').card.background, '#EDF5FF', 'page inherits unspecified component fields');
assert.equal(resolveThemeComponents(scopedComponents, 'calendar').card.radius, 20, 'page override never leaks');
const individuallyColored = structuredClone(theme);
individuallyColored.tokens.components.button = {
  secondaryBackground: '#F8D3F7', secondaryForeground: '#27283A',
  dangerBackground: '#C65A66', dangerForeground: '#000000',
  toneSecondaryBackground: '#C2E0FD', toneSecondaryForeground: '#000000',
  toneTertiaryBackground: '#FED8B7', toneTertiaryForeground: '#000000',
};
assert.deepEqual(validateTheme(individuallyColored), individuallyColored, 'each shared button variant can store its own accessible colors');
assert.equal(isValidTheme(individuallyColored), true, 'mobile accepts editable button variant colors');
assert.equal(resolveThemeComponents(individuallyColored, 'home').button.dangerBackground, '#C65A66', 'button variant tokens reach the mobile component resolver');
const unreadableButton = structuredClone(individuallyColored);
unreadableButton.tokens.components.button = { ...unreadableButton.tokens.components.button, dangerForeground: '#C65A66' };
assert.throws(() => validateTheme(unreadableButton), /contrast/i, 'button background and text colors are checked together');
const surfaceInheritance = structuredClone(theme);
surfaceInheritance.tokens.components.card = { background: '#EDF5FF' };
surfaceInheritance.tokens.pageGroups = { commerce: { pages: ['home'], colors: { surface: '#DDEEFF' } } };
assert.equal(resolveThemeComponents(surfaceInheritance, 'home').card.background, '#EDF5FF', 'explicit shared card color wins over a page group surface default');
surfaceInheritance.tokens.pageComponents = { home: { card: { background: '#EAF0FF' } } };
assert.equal(resolveThemeComponents(surfaceInheritance, 'home').card.background, '#EAF0FF', 'individual page card override wins over shared card color');
delete surfaceInheritance.tokens.pageComponents;
delete surfaceInheritance.tokens.components.card;
assert.equal(resolveThemeComponents(surfaceInheritance, 'home').card.background, '#DDEEFF', 'page group surface remains the inherited card default');
delete scopedComponents.tokens.pageComponents.home;
assert.equal(resolveThemeComponents(scopedComponents, 'home').card.radius, 20, 'reset restores shared component');
for (const page of THEME_SCREENS) assert.equal(resolveThemeComponents(theme, page.id).card, undefined, 'registered screens inherit bundled defaults without a stored page document');
const unsafePageComponents = { ...theme, tokens: { ...theme.tokens, pageComponents: { home: { card: { padding: 999 } } } } };
rejected(unsafePageComponents);
assert.equal(isValidTheme(unsafePageComponents), false);
assert.throws(() => parseThemeJson(JSON.stringify(unsafePageComponents)), /pageComponents.home.card.padding/);
rejected({ ...theme, tokens: { ...theme.tokens, pageComponents: { nonexistent: { card: { radius: 20 } } } } });
const basePalette = {
  background: '#E9EEFB', backgroundBrand: '#E5EFF9', backgroundCreator: '#E2EEF8', backgroundGradientTop: '#E9EEFB', backgroundGradientRight: '#E2EEF8', backgroundGradientBottom: '#E5EFF9', backgroundGradientLeft: '#DBECF3',
  surface: '#FAFDFE', surfaceRaised: '#FAFDFE', surfaceHero: '#F2F7FE', surfaceMuted: '#C7EBC5', surfaceSky: '#C2E0FD', surfaceMint: '#AAEDE3', surfaceButter: '#F7E0AF', surfaceBlush: '#FED8B7', surfaceLilac: '#F8D3F7',
  textPrimary: '#2B2736', textSecondary: '#777486', secondaryText: '#426B75', tertiaryText: '#7D5942', inputPlaceholder: '#9B98A8', inputBackground: '#FAF9F6', cardBorder: '#EAE9EF', border: '#E2E2EB', accent: '#B0B2F4', accentText: '#5C5FC1',
} as Parameters<typeof resolveThemePalette>[0];
const cardTheme = structuredClone(theme);
cardTheme.tokens.components.card = { background: '#EDF5FF', border: '#334455' };
cardTheme.tokens.colors.light.text = '#123456';
cardTheme.tokens.colors.light.mutedText = '#334455';
assert.equal(isValidTheme(cardTheme), true, 'edited card and text colors remain valid');
for (const screen of THEME_SCREENS) {
  const palette = resolveThemePalette(basePalette, cardTheme, 'light', screen.id);
  assert.equal(palette.textPrimary, '#123456', `${screen.id} uses edited text color`);
  assert.equal(palette.textSecondary, '#334455', `${screen.id} uses edited muted text color`);
  assert.equal(palette.surfaceSky, basePalette.surfaceSky, `${screen.id} keeps its own sky surface unless configured`);
  assert.equal(palette.surfaceHero, basePalette.surfaceHero, `${screen.id} keeps its own hero surface unless configured`);
  assert.equal(palette.cardBorder, '#334455', `${screen.id} uses shared card border`);
}
const baselinePalette = resolveThemePalette(basePalette, theme, 'light', 'home');
assert.equal(baselinePalette.surfaceSky, basePalette.surfaceSky, 'bundled card tone stays unchanged by the baseline theme');
assert.equal(baselinePalette.surfaceHero, basePalette.surfaceHero, 'bundled hero tone stays unchanged by the baseline theme');
const gradientTheme = structuredClone(theme);
gradientTheme.tokens.gradients = { light: { top: '#E9EEFB', right: '#E2EEF8', bottom: '#E5EFF9', left: '#DBECF3' }, dark: { top: '#16141D', right: '#1C2432', bottom: '#182B31', left: '#20253B' } };
gradientTheme.tokens.colors.light.secondary = '#A9ABF3';
gradientTheme.tokens.colors.light.accent = '#B0B2F4';
gradientTheme.tokens.components.card = { background: '#FAFDFE', backgroundHero: '#F2F7FE', backgroundMuted: '#C7EBC5', backgroundSky: '#C2E0FD', backgroundMint: '#AAEDE3', backgroundButter: '#F7E0AF', backgroundBlush: '#FED8B7', backgroundLilac: '#F8D3F7' };
gradientTheme.tokens.components.navigation = { background: '#FAFDFE' };
assert.deepEqual(validateTheme(gradientTheme), gradientTheme, 'four independent light and dark gradient stops persist');
assert.equal(isValidTheme(gradientTheme), true, 'mobile accepts built-in gradient presets');
assert.deepEqual(parseThemeJson(exportThemeJson(gradientTheme)), gradientTheme, 'JSON import/export preserves built-in gradient presets');
assert.throws(() => parseThemeJson(exportThemeJson({ ...gradientTheme, tokens: { ...gradientTheme.tokens, gradients: { ...gradientTheme.tokens.gradients, light: { ...gradientTheme.tokens.gradients!.light, unsafe: '#FFFFFF' } } } })), /tokens\.gradients\.light\.unsafe: unsupported field/);
assert.deepEqual([resolveThemePalette(basePalette, gradientTheme, 'light').backgroundGradientTop, resolveThemePalette(basePalette, gradientTheme, 'light').backgroundGradientRight, resolveThemePalette(basePalette, gradientTheme, 'light').backgroundGradientBottom, resolveThemePalette(basePalette, gradientTheme, 'light').backgroundGradientLeft], ['#E9EEFB', '#E2EEF8', '#E5EFF9', '#DBECF3']);
const creatorPalette = resolveThemePalette(basePalette, gradientTheme, 'light');
assert.deepEqual([creatorPalette.secondary, creatorPalette.accent, creatorPalette.surface, creatorPalette.surfaceHero, creatorPalette.surfaceSky, creatorPalette.surfaceMint, creatorPalette.surfaceButter, creatorPalette.surfaceBlush, creatorPalette.surfaceLilac], ['#A9ABF3', '#B0B2F4', '#FAFDFE', '#F2F7FE', '#C2E0FD', '#AAEDE3', '#F7E0AF', '#FED8B7', '#F8D3F7']);
assert.equal(creatorPalette.surfaceMuted, '#C7EBC5');
rejected({ ...gradientTheme, tokens: { ...gradientTheme.tokens, gradients: { ...gradientTheme.tokens.gradients, light: { ...gradientTheme.tokens.gradients!.light, right: 'url(javascript:alert(1))' } } } });
const surfaceOnlyTheme = structuredClone(theme);
surfaceOnlyTheme.tokens.colors.light.surface = '#F1EDE7';
const unifiedSurfacePalette = resolveThemePalette(basePalette, surfaceOnlyTheme, 'light', 'home');
assert.equal(unifiedSurfacePalette.surfaceRaised, '#F1EDE7', 'base card surface follows the Brand surface control');
for (const key of ['surfaceHero', 'surfaceMuted', 'surfaceSky', 'surfaceMint', 'surfaceButter', 'surfaceBlush', 'surfaceLilac'] as const) assert.equal(unifiedSurfacePalette[key], basePalette[key], `${key} preserves its independent bundled card color`);
cardTheme.tokens.components.card.backgroundSky = '#D9ECFF';
cardTheme.tokens.components.card.backgroundHero = '#F1E3FF';
assert.equal(isValidTheme(cardTheme), true, 'independent card surface colors validate safely');
assert.equal(resolveThemePalette(basePalette, cardTheme, 'light', 'home').surfaceSky, '#D9ECFF', 'sky card color is independently editable');
assert.equal(resolveThemePalette(basePalette, cardTheme, 'light', 'home').surfaceHero, '#F1E3FF', 'hero card color is independently editable');
cardTheme.tokens.pageComponents = { home: { card: { backgroundSky: '#CFEAFF' } } };
assert.equal(isValidTheme(cardTheme), true, 'per-page card colors remain schema-valid');
assert.equal(resolveThemePalette(basePalette, cardTheme, 'light', 'home').surfaceSky, '#CFEAFF', 'page card override is applied only to that screen');
assert.equal(resolveThemePalette(basePalette, cardTheme, 'light', 'calendar').surfaceSky, '#D9ECFF', 'shared card color remains on other screens');
assert.deepEqual(parseThemeJson(exportThemeJson(groupedTheme)), groupedTheme, "JSON export imports as the same valid theme document");
assert.throws(() => parseThemeJson(JSON.stringify({ ...groupedTheme, tokens: { ...groupedTheme.tokens, pages: { fakeRoute: { primary: "#5C5FC1" } } } })), /tokens\.pages\.fakeRoute/);
assert.throws(() => parseThemeJson(JSON.stringify({ ...groupedTheme, injected: "<script>alert(1)</script>" })), /executable code, HTML/);
assert.throws(() => parseThemeJson("null"), /theme/);
assert.throws(() => validateTheme({ ...groupedTheme, tokens: { ...groupedTheme.tokens, pageGroups: { commerce: { pages: ["home"], colors: {} }, workspace: { pages: ["home"], colors: {} } } } }), /duplicate/);
rejected({ ...theme, executable: "alert(1)" });
rejected({ ...theme, tokens: { ...theme.tokens, colors: { ...theme.tokens.colors, light: { ...theme.tokens.colors.light, primary: "url(javascript:alert(1))" } } } });
rejected({ ...theme, tokens: { ...theme.tokens, colors: { ...theme.tokens.colors, light: { ...theme.tokens.colors.light, text: "#FFFFFF00" } } } });
rejected({ ...theme, tokens: { ...theme.tokens, spacing: { ...theme.tokens.spacing, md: 999 } } });
rejected({ ...theme, tokens: { ...theme.tokens, shadows: { ...theme.tokens.shadows, dark: { ...theme.tokens.shadows.dark, modalRadius: 80 } } } });
rejected({ ...theme, tokens: { ...theme.tokens, colors: { ...theme.tokens.colors, light: { ...theme.tokens.colors.light, text: "#ffffff" } } } });
rejected({ ...theme, tokens: { ...theme.tokens, components: { card: { background: "#5C5FC1" } } } });
rejected({ ...theme, tokens: { ...theme.tokens, components: { card: { backgroundSky: '#2B2736' } } } });
assert.equal(isValidTheme({ ...theme, schemaVersion: 2 }), false);
assert.equal(isValidTheme({ ...theme, tokens: { ...theme.tokens, opacity: { disabled: 4, overlay: 0.5 } } }), false);
const missingSpacing = structuredClone(theme) as unknown as Record<string, any>; delete missingSpacing.tokens.spacing.md;
assert.equal(isValidTheme(missingSpacing), false); rejected(missingSpacing);
const missingShadow = structuredClone(theme) as unknown as Record<string, any>; delete missingShadow.tokens.shadows.light.card;
assert.equal(isValidTheme(missingShadow), false); rejected(missingShadow);
rejected({ ...theme, name: '<script>alert(1)</script>' });
assert.throws(() => parseThemeJson(' '.repeat(256 * 1024 + 1)), /256 KB/);
assert.equal(isValidTheme({ ...theme, tokens: { ...theme.tokens, components: { button: { background: '#5C5FC1' } } } }), true, 'button background can use the safe automatic foreground');
const cached = theme as unknown as ThemeDocument;
assert.equal(chooseValidTheme({ schemaVersion: 2 }, cached, cached), cached, "invalid remote response retains cached theme");
assert.equal(chooseValidTheme(null, null, cached), cached, "offline startup retains bundled theme");
let appliedAfterCacheFailure = false;
const storageFailureRefresh = createThemeRefresher(async () => ({ etag: 'remote-v1', theme }), async () => { throw new Error('storage unavailable'); }, isValidTheme);
await storageFailureRefresh('', (value) => { appliedAfterCacheFailure = value === theme; });
assert.equal(appliedAfterCacheFailure, true, 'cache write failures do not prevent applying a valid remote theme');
let remoteRequestCount = 0;
let finishRemoteRequest!: (value: { etag: string; theme: typeof theme } | null) => void;
const concurrentRefresh = createThemeRefresher(() => { remoteRequestCount += 1; return new Promise((resolve) => { finishRemoteRequest = resolve; }); }, async () => undefined, isValidTheme);
let firstApplied = 0; let secondApplied = 0;
const firstRefresh = concurrentRefresh('', () => { firstApplied += 1; });
const secondRefresh = concurrentRefresh('', () => { secondApplied += 1; });
finishRemoteRequest({ etag: 'remote-v2', theme });
await Promise.all([firstRefresh, secondRefresh]);
assert.equal(remoteRequestCount, 1, 'overlapping launch and foreground refreshes share one request');
assert.equal(firstApplied + secondApplied, 2, 'all mounted refresh callers receive the shared valid result');
let invalidApplied = false;
const invalidRefresh = createThemeRefresher(async () => ({ etag: 'bad', theme: { schemaVersion: 2 } as unknown as typeof theme }), async () => undefined, isValidTheme);
await invalidRefresh('', () => { invalidApplied = true; });
assert.equal(invalidApplied, false, 'an invalid remote payload is never applied');
let offlineApplied = false;
await createThemeRefresher(async () => null, async () => undefined, isValidTheme)('', () => { offlineApplied = true; });
assert.equal(offlineApplied, false, 'offline response leaves the current bundled or cached theme untouched');

const oldDocument = structuredClone(theme);
const versions = [{ id: "older-version", scope: "mobile", name: theme.name, revision: 1, document: oldDocument, changeNote: "first", authorId: "admin:owner", createdAt: new Date() }];
const activations: Array<{ versionId: string; action: string }> = [];
let currentVersion = "older-version";
let publishedRevision: number | null = null;
let nextRevision = 2;
let nextVersion = 0;
const tx = {
  appThemeDraft: {
    findFirst: async () => ({ id: "draft", scope: "mobile", name: theme.name, revision: nextRevision, publishedRevision, document: theme, changeNote: "updated" }),
    updateMany: async ({ where, data }: { where: { revision: number; publishedRevision: number | null }; data: { publishedRevision: number } }) => {
      if (where.revision !== nextRevision || where.publishedRevision !== publishedRevision) return { count: 0 };
      publishedRevision = data.publishedRevision;
      return { count: 1 };
    },
  },
  appThemeVersion: {
    findFirst: async ({ where }: { where: { id?: string; name?: string } }) => where.id ? versions.find((item) => item.id === where.id) ?? null : versions.filter((item) => item.name === where.name).sort((a, b) => b.revision - a.revision)[0] ?? null,
    findUnique: async ({ where }: { where: { id: string } }) => versions.find((item) => item.id === where.id) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => { const item = { ...data, id: `version-${++nextVersion}`, createdAt: new Date() }; versions.push(item as typeof versions[number]); return item; },
  },
  appThemeActivation: { create: async ({ data }: { data: { versionId: string; action: string } }) => { activations.push(data); return data; } },
  appThemeCurrent: {
    findUnique: async () => ({ versionId: currentVersion, updatedAt: new Date() }),
    upsert: async ({ create, update }: { create: { versionId: string }; update: { versionId: string } }) => { currentVersion = update.versionId ?? create.versionId; return { versionId: currentVersion }; },
  },
};
const prisma = { ...tx, $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) };
const service = new ThemesService(prisma as never);
const emptyService = new ThemesService({ appThemeCurrent: { findUnique: async () => null }, appThemeVersion: { findUnique: async () => null } } as never);
const bundled = await emptyService.active();
assert.equal(bundled.body.id, "bundled-default-v1", "no published theme serves the bundled baseline");
assert.deepEqual(validateTheme(bundled.body.theme), theme, "bundled fallback is a valid theme document");
await service.publish("admin:owner", "draft", { expectedRevision: 2 });
assert.equal(currentVersion, "version-1", "publish atomically switches active version");
assert.equal(publishedRevision, 2, "the exact draft revision is marked as published");
const published = await service.active();
assert.notEqual(published.etag, bundled.etag, "active validator changes when the returned representation changes");
await assert.rejects(() => service.publish("admin:owner", "draft", { expectedRevision: 2 }), ConflictException, "a saved revision cannot be published twice");
nextRevision = 3;
await Promise.allSettled([
  service.publish("admin:owner", "draft", { expectedRevision: 3 }),
  service.publish("admin:owner", "draft", { expectedRevision: 3 }),
]);
assert.equal(versions.filter((item) => item.revision === 3).length, 1, "concurrent publish claims a draft revision once");
await service.activate("admin:owner", "older-version");
assert.equal(currentVersion, "older-version", "restore moves active pointer to selected snapshot");
assert.deepEqual(versions[0].document, oldDocument, "restore does not mutate historical version values");
assert.equal(activations.at(-1)?.action, "RESTORE", "restore creates an audit event");

const controller = new AdminThemesController({} as never);
for (const method of ["drafts", "draft", "create", "update", "publish", "versions", "version", "activations", "activate"] as const) {
  assert.throws(() => (controller[method] as (...args: unknown[]) => unknown)({ userId: "x", role: "CREATOR" }), ForbiddenException);
}
console.log("Theme schema, bundled fallback, full-response ETag, publish-once concurrency, restore, immutable snapshot, and admin-write authorization checks passed.");
