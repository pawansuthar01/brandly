import { THEME_PAGE_GROUPS, THEME_SCREENS, THEME_CONTENT_FIELDS, getThemePageGroup, componentOverrideError, type ComponentOverrides, type ThemeContentKey } from "./themeScreens";

const colorKeys = ["primary", "secondary", "accent", "background", "surface", "text", "mutedText", "border", "focus", "overlay", "success", "warning", "error", "info"] as const;
export type ThemeDocument = { schemaVersion: 1; name: string; content?: Partial<Record<ThemeContentKey, string>>; tokens: { colors: Record<"light" | "dark", Record<(typeof colorKeys)[number], string>>; gradients?: Record<"light" | "dark", Record<"top" | "right" | "bottom" | "left", string>>; typography: Record<string, { size: number; lineHeight: number; weight: string; family: "system" | "display" }>; spacing: Record<string, number>; radius: Record<string, number>; opacity: { disabled: number; overlay: Record<"light" | "dark", number> }; borders: { width: number }; elevation: Record<string, number>; shadows: Record<"light" | "dark", { color: string; card: number; floating: number; modal: number; cardRadius: number; floatingRadius: number; modalRadius: number }>; components: Record<string, Record<string, string | number>>; pages: Record<string, Record<string, string | number>>; pageComponents?: Record<string, ComponentOverrides>; pageGroups?: Partial<Record<(typeof THEME_PAGE_GROUPS)[number]["id"], { pages: (typeof THEME_SCREENS)[number]["id"][]; colors: Partial<Record<(typeof colorKeys)[number], string>>; followRegistry?: boolean }>> } };
const contrastRatio = (a: string, b: string) => { const lum = (hex: string) => hex.slice(1, 7).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0); const pair = [lum(a), lum(b)].sort((x, y) => y - x); return (pair[0] + .05) / (pair[1] + .05); };

export function resolveThemeColors(document: ThemeDocument, mode: "light" | "dark", page?: string) {
  const group = getThemePageGroup(document.tokens.pageGroups ?? {}, page);
  return { ...document.tokens.colors[mode], ...group?.colors, ...(document.tokens.pages[page ?? ""] ?? {}) };
}

export function resolveThemeContent(document: ThemeDocument, key: ThemeContentKey, fallback: string): string {
  return document.content?.[key] ?? fallback;
}

export function isValidTheme(value: unknown, options: { allowLowContrast?: boolean } = {}): value is ThemeDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<ThemeDocument>;
  if (doc.schemaVersion !== 1 || typeof doc.name !== "string" || !doc.name.trim() || doc.name.length > 80 || !doc.tokens) return false;
  const tokens = doc.tokens;
  if (/<\s*\/?\s*[a-z!][^>]*>|javascript:|url\s*\(|expression\s*\(|@import/i.test(doc.name)) return false;
  if (Object.keys(doc).some((key) => !["schemaVersion", "name", "content", "tokens"].includes(key)) || Object.keys(tokens).some((key) => !["colors", "gradients", "typography", "spacing", "radius", "opacity", "borders", "elevation", "shadows", "components", "pages", "pageGroups", "pageComponents"].includes(key))) return false;
  const gradientTokens = tokens.gradients;
  if (gradientTokens !== undefined && (!gradientTokens || typeof gradientTokens !== 'object' || Array.isArray(gradientTokens) || Object.keys(gradientTokens).some((key) => !['light', 'dark'].includes(key)) || (['light', 'dark'] as const).some((mode) => { const stops = gradientTokens[mode]; return !stops || typeof stops !== 'object' || Array.isArray(stops) || Object.keys(stops).some((key) => !['top', 'right', 'bottom', 'left'].includes(key)) || ['top', 'right', 'bottom', 'left'].some((key) => !/^#[\da-f]{6}$/i.test(String(stops[key as keyof typeof stops] ?? ''))); }))) return false;
  if (doc.content !== undefined && (!doc.content || typeof doc.content !== 'object' || Array.isArray(doc.content) || Object.keys(doc.content).some((key) => { const spec = THEME_CONTENT_FIELDS.find((item) => item.id === key); const text = doc.content?.[key as ThemeContentKey]; return !spec || typeof text !== 'string' || text.length > spec.maxLength || /<\s*\/?\s*[a-z!][^>]*>|javascript:|url\s*\(|expression\s*\(|@import/i.test(text); }))) return false;
  for (const mode of ["light", "dark"] as const) {
    const colors = doc.tokens.colors?.[mode];
    if (!colors || Object.keys(colors).some((key) => !colorKeys.includes(key as (typeof colorKeys)[number])) || colorKeys.some((key) => typeof colors[key] !== "string" || !(key === "overlay" ? /^#[\da-f]{6}([\da-f]{2})?$/i.test(colors[key]) : /^#[\da-f]{6}$/i.test(colors[key])))) return false;
    const luminance = (color: string) => color.slice(1, 7).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a: string, b: string) => { const pair = [luminance(a), luminance(b)].sort((x, y) => y - x); return (pair[0] + .05) / (pair[1] + .05); };
    if (!options.allowLowContrast && (ratio(colors.text, colors.background) < 4.5 || ratio(colors.text, colors.surface) < 4.5)) return false;
  }
  if (!doc.tokens.typography || !doc.tokens.spacing || !doc.tokens.radius || !doc.tokens.opacity || !doc.tokens.borders || !doc.tokens.elevation || !doc.tokens.shadows || !doc.tokens.components || !doc.tokens.pages) return false;
  if (Object.keys(doc.tokens.spacing).some((key) => !["xs", "sm", "md", "lg", "xl", "xxl"].includes(key)) || Object.keys(doc.tokens.radius).some((key) => !["sm", "control", "md", "lg", "pill"].includes(key)) || Object.keys(doc.tokens.typography).some((key) => !["caption", "body", "bodyLarge", "title", "display", "hero"].includes(key))) return false;
  if (Object.keys(doc.tokens.pages).some((key) => !THEME_SCREENS.some((screen) => screen.id === key))) return false;
  if (['xs','sm','md','lg','xl','xxl'].some((key) => typeof tokens.spacing[key] !== 'number' || !Number.isFinite(tokens.spacing[key])) || ['sm','control','md','lg','pill'].some((key) => typeof tokens.radius[key] !== 'number' || !Number.isFinite(tokens.radius[key])) || ['caption','body','bodyLarge','title','display','hero'].some((key) => !tokens.typography[key])) return false;
  for (const value of Object.values(doc.tokens.spacing)) if (typeof value !== "number" || value < 0 || value > 64) return false;
  for (const [key, value] of Object.entries(doc.tokens.radius)) if (typeof value !== "number" || value < 0 || value > (key === "pill" ? 999 : 128)) return false;
  for (const item of Object.values(doc.tokens.typography)) if (!item || Object.keys(item).some((key) => !["size", "lineHeight", "weight", "family"].includes(key)) || typeof item.size !== "number" || item.size < 10 || item.size > 64 || typeof item.lineHeight !== "number" || item.lineHeight < item.size || item.lineHeight > 96 || !["400", "500", "600", "700", "800", "900"].includes(item.weight) || !["system", "display"].includes(item.family)) return false;
  if (componentOverrideError(tokens.components, 'tokens.components')) return false;
  for (const fields of Object.values(tokens.pages)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).some((key) => !colorKeys.includes(key as (typeof colorKeys)[number]))) return false;
    if (Object.entries(fields).some(([key, color]) => typeof color !== 'string' || !(key === 'overlay' ? /^#[\da-f]{6}([\da-f]{2})?$/i : /^#[\da-f]{6}$/i).test(color))) return false;
  }
  if (tokens.pageComponents !== undefined) {
    if (!tokens.pageComponents || typeof tokens.pageComponents !== 'object' || Array.isArray(tokens.pageComponents)) return false;
    for (const [page, fields] of Object.entries(tokens.pageComponents)) if (!THEME_SCREENS.some((screen) => screen.id === page) || componentOverrideError(fields, `pageComponents.${page}`)) return false;
  }
  const pageGroups = tokens.pageGroups ?? {};
  if (!pageGroups || typeof pageGroups !== "object" || Array.isArray(pageGroups) || Object.keys(pageGroups).some((key) => !THEME_PAGE_GROUPS.some((group) => group.id === key))) return false;
  const assignedPages = new Set<string>();
  for (const [name, group] of Object.entries(pageGroups)) {
    if (!group || typeof group !== "object" || Array.isArray(group) || Object.keys(group).some((key) => !["pages", "colors", "followRegistry"].includes(key)) || group.followRegistry !== undefined && typeof group.followRegistry !== "boolean" || !Array.isArray(group.pages) || !group.colors || typeof group.colors !== "object" || Array.isArray(group.colors)) return false;
    if (new Set(group.pages).size !== group.pages.length || group.pages.some((page) => typeof page !== "string" || !THEME_SCREENS.some((screen) => screen.id === page) || assignedPages.has(page))) return false;
    for (const page of group.pages) assignedPages.add(page);
    if (Object.keys(group.colors).some((key) => !colorKeys.includes(key as (typeof colorKeys)[number]))) return false;
    if (Object.entries(group.colors).some(([key, color]) => {
      const validColor = typeof color === "string" && (key === "overlay" ? /^#[\da-f]{6}([\da-f]{2})?$/i.test(color) : /^#[\da-f]{6}$/i.test(color));
      return !validColor;
    })) return false;
  }
  for (const screen of THEME_SCREENS) {
    const color = resolveThemeColors(doc as ThemeDocument, 'light', screen.id);
    for (const [name, fields] of Object.entries(tokens.pageComponents?.[screen.id] ?? {})) {
      const values = { ...tokens.components[name], ...fields };
      if (!options.allowLowContrast && Object.entries(values).some(([key, value]) => { const isBackground = key === 'background' || key.startsWith('background') || key.endsWith('Background'); const foregroundKey = key === 'background' ? 'foreground' : key.endsWith('Background') ? `${key.slice(0, -10)}Foreground` : 'foreground'; const foreground = values[foregroundKey] ?? values.foreground ?? color.text; return isBackground && !(name === 'button' && key === 'background' && !values.foreground) && contrastRatio(String(value), String(foreground)) < 4.5; })) return false;
    }
  }
  if (!options.allowLowContrast && Object.entries(tokens.components).some(([name, values]) => Object.entries(values).some(([key, value]) => { const isBackground = key === 'background' || key.startsWith('background') || key.endsWith('Background'); const foregroundKey = key === 'background' ? 'foreground' : key.endsWith('Background') ? `${key.slice(0, -10)}Foreground` : 'foreground'; const foreground = values[foregroundKey] ?? values.foreground ?? tokens.colors.light.text; return isBackground && !(name === 'button' && key === 'background' && !values.foreground) && contrastRatio(String(value), String(foreground)) < 4.5; }))) return false;
  for (const mode of ["light", "dark"] as const) { const shadow = tokens.shadows[mode]; if (!shadow || Object.keys(shadow).some((key) => !["color", "card", "floating", "modal", "cardRadius", "floatingRadius", "modalRadius"].includes(key)) || !/^#[\da-f]{6}$/i.test(shadow.color) || [shadow.card, shadow.floating, shadow.modal].some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 0.35) || [shadow.cardRadius, shadow.floatingRadius, shadow.modalRadius].some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 48)) return false; }
  if (!options.allowLowContrast) for (const screen of THEME_SCREENS) for (const mode of ["light", "dark"] as const) { const shared = getThemePageGroup(pageGroups, screen.id)?.colors ?? {}; const colors = { ...tokens.colors[mode], ...shared, ...tokens.pages[screen.id] } as Record<string, string>; if (contrastRatio(colors.text, colors.background) < 4.5 || contrastRatio(colors.text, colors.surface) < 4.5) return false; }
  return Object.keys(tokens.opacity).every((key) => ["disabled", "overlay"].includes(key)) && tokens.opacity.disabled >= 0.2 && tokens.opacity.disabled <= 0.7 && Object.keys(tokens.opacity.overlay).length === 2 && ["light", "dark"].every((key) => typeof tokens.opacity.overlay[key as "light" | "dark"] === "number" && tokens.opacity.overlay[key as "light" | "dark"] >= 0 && tokens.opacity.overlay[key as "light" | "dark"] <= 1) && Object.keys(tokens.borders).length === 1 && tokens.borders.width >= 0 && tokens.borders.width <= 4 && ["card", "floating", "modal"].every((key) => typeof tokens.elevation[key] === "number" && tokens.elevation[key] >= 0 && tokens.elevation[key] <= 24);
}

export function chooseValidTheme(remote: unknown, cached: unknown, bundled: ThemeDocument): ThemeDocument {
  if (isValidTheme(remote)) return remote;
  if (isValidTheme(cached)) return cached;
  return bundled;
}

export function resolveThemeComponents(document: ThemeDocument, page?: string): Record<string, Record<string, string | number>> {
  const overrides = document.tokens.pageComponents?.[page ?? ''] ?? {};
  const group = getThemePageGroup(document.tokens.pageGroups ?? {}, page);
  const colors = { ...group?.colors, ...document.tokens.pages[page ?? ''] };
  const shared = { ...document.tokens.components };
  if (typeof colors.surface === 'string') for (const key of ['card', 'input', 'dialog', 'list']) shared[key] = { background: colors.surface, ...shared[key] };
  if (typeof colors.border === 'string') for (const key of ['card', 'input', 'dialog', 'list', 'navigation', 'tabs', 'chip']) shared[key] = { border: colors.border, ...shared[key] };
  if (typeof colors.primary === 'string') shared.button = { background: colors.primary, ...shared.button };
  return Object.fromEntries(Array.from(new Set([...Object.keys(shared), ...Object.keys(overrides)])).map((key) => [key, { ...shared[key], ...overrides[key as keyof typeof overrides] }]));
}
