import { BadRequestException } from "@nestjs/common";

import { THEME_SCREENS, THEME_PAGE_GROUPS, THEME_COMPONENTS, THEME_CONTENT_FIELDS, getThemePageGroup, componentOverrideError, type ComponentOverrides, type ThemeContentKey } from './theme-registry.js';
export const themeComponents = Object.keys(THEME_COMPONENTS) as (keyof typeof THEME_COMPONENTS)[];
export const themePages = THEME_SCREENS.map((screen) => screen.id);
export const themePageGroups = THEME_PAGE_GROUPS.map((group) => group.id);
const semanticColors = ["primary", "secondary", "accent", "background", "surface", "text", "mutedText", "border", "focus", "overlay", "success", "warning", "error", "info"] as const;
const componentFields = THEME_COMPONENTS;
const modes = ["light", "dark"] as const;
const numericGroups = { spacing: ["xs", "sm", "md", "lg", "xl", "xxl"], radius: ["sm", "control", "md", "lg", "pill"] } as const;

export type AppThemeDocument = {
  schemaVersion: 1;
  name: string;
  content?: Partial<Record<ThemeContentKey, string>>;
  tokens: {
    colors: Record<"light" | "dark", Record<(typeof semanticColors)[number], string>>;
    gradients?: Record<"light" | "dark", Record<"top" | "right" | "bottom" | "left", string>>;
    typography: Record<string, { size: number; weight: "400" | "500" | "600" | "700" | "800" | "900"; lineHeight: number; family: "system" | "display" }>;
    spacing: Record<(typeof numericGroups.spacing)[number], number>;
    radius: Record<(typeof numericGroups.radius)[number], number>;
    opacity: { disabled: number; overlay: Record<"light" | "dark", number> };
    borders: { width: number };
    elevation: { card: number; floating: number; modal: number };
    shadows: Record<"light" | "dark", { color: string; card: number; floating: number; modal: number; cardRadius: number; floatingRadius: number; modalRadius: number }>;
    components: Partial<Record<(typeof themeComponents)[number], Record<string, string | number>>>;
    pages: Partial<Record<(typeof themePages)[number], Record<string, string | number>>>;
    pageComponents?: Partial<Record<(typeof themePages)[number], ComponentOverrides>>;
    pageGroups?: Partial<Record<(typeof themePageGroups)[number], { pages: (typeof themePages)[number][]; colors: Partial<Record<(typeof semanticColors)[number], string>>; followRegistry?: boolean }>>;
  };
};

export const defaultTheme: AppThemeDocument = {
  schemaVersion: 1, name: "Brandly default", tokens: {
    colors: {
      light: { primary: "#5C5FC1", secondary: "#C2E0FD", accent: "#B0B2F4", background: "#E9EEFB", surface: "#FAFDFE", text: "#2B2736", mutedText: "#777486", border: "#E2E2EB", focus: "#A9ABF3", overlay: "#2B273699", success: "#1C876F", warning: "#D97706", error: "#C65A66", info: "#426B75" },
      dark: { primary: "#BBA8FF", secondary: "#5D8F9B", accent: "#423C67", background: "#16141D", surface: "#211D2C", text: "#F7F4FF", mutedText: "#C4BED0", border: "#464056", focus: "#BBA8FF", overlay: "#000000C7", success: "#7EE2C0", warning: "#FFB454", error: "#FF9EA9", info: "#D6F0F3" },
    },
    typography: Object.fromEntries([["caption", 12, 18], ["body", 15, 22], ["bodyLarge", 16, 24], ["title", 20, 28], ["display", 30, 36], ["hero", 38, 44]].map(([key, size, lineHeight]) => [key, { size, lineHeight, weight: key === "title" || key === "display" || key === "hero" ? "700" : "400", family: key === "display" || key === "hero" ? "display" : "system" }])) as AppThemeDocument["tokens"]["typography"],
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 }, radius: { sm: 12, control: 16, md: 20, lg: 28, pill: 999 }, opacity: { disabled: 0.48, overlay: { light: 0.6, dark: 0.78 } },
    borders: { width: 1 }, elevation: { card: 0, floating: 1, modal: 4 }, shadows: { light: { color: "#2B2736", card: 0, floating: 0.04, modal: 0.12, cardRadius: 0, floatingRadius: 5, modalRadius: 12 }, dark: { color: "#000000", card: 0, floating: 0.12, modal: 0.22, cardRadius: 0, floatingRadius: 6, modalRadius: 10 } }, components: {}, pages: {}, pageGroups: {},
  },
};

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new BadRequestException(`${path} has unsupported keys`);
}
export function validateTheme(value: unknown, options: { allowLowContrast?: boolean } = {}): AppThemeDocument {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.name !== "string" || !value.name.trim() || value.name.length > 80 || !record(value.tokens)) throw new BadRequestException("Invalid theme document or unsupported schema version");
  exactKeys(value, ["schemaVersion", "name", "content", "tokens"], "theme");
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 256 * 1024) throw new BadRequestException('theme exceeds the 256 KB limit');
  if (/<\s*\/?\s*[a-z!][^>]*>|javascript:|url\s*\(|expression\s*\(|@import/i.test(value.name)) throw new BadRequestException('theme.name contains unsupported HTML, scripts, or CSS');
  if (value.content !== undefined) {
    if (!record(value.content)) throw new BadRequestException('Invalid content');
    exactKeys(value.content, THEME_CONTENT_FIELDS.map(({ id }) => id), 'content');
    for (const [key, text] of Object.entries(value.content)) {
      const field = THEME_CONTENT_FIELDS.find((item) => item.id === key)!;
      if (typeof text !== 'string' || text.length > field.maxLength || /<\s*\/?\s*[a-z!][^>]*>|javascript:|url\s*\(|expression\s*\(|@import/i.test(text)) throw new BadRequestException(`Invalid content.${key}`);
    }
  }
  const t = value.tokens;
  exactKeys(t, ["colors", "gradients", "typography", "spacing", "radius", "opacity", "borders", "elevation", "shadows", "components", "pages", "pageGroups", "pageComponents"], "tokens");
  if (t.gradients !== undefined) {
    if (!record(t.gradients)) throw new BadRequestException("Invalid gradients");
    exactKeys(t.gradients, modes, "gradients");
    for (const mode of modes) {
      const stops = t.gradients[mode];
      if (!record(stops)) throw new BadRequestException(`Invalid gradients.${mode}`);
      exactKeys(stops, ["top", "right", "bottom", "left"], `gradients.${mode}`);
      for (const side of ["top", "right", "bottom", "left"] as const) if (typeof stops[side] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(stops[side] as string)) throw new BadRequestException(`Invalid gradients.${mode}.${side}`);
    }
  }
  if (!record(t.colors) || !record(t.colors.light) || !record(t.colors.dark) || Object.keys(t.colors).some((key) => !modes.includes(key as typeof modes[number]))) throw new BadRequestException("Both light and dark colors are required");
  for (const mode of modes) {
    const colors = t.colors[mode] as Record<string, unknown>;
    exactKeys(colors, semanticColors, `colors.${mode}`);
    for (const color of semanticColors) if (typeof colors[color] !== "string" || !(color === "overlay" ? /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(colors[color] as string) : /^#[0-9a-fA-F]{6}$/.test(colors[color] as string))) throw new BadRequestException(`Invalid color: ${mode}.${color}`);
    const luminance = (hex: string) => { const rgb = hex.slice(1, 7).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2); return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; };
    const contrast = (a: string, b: string) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
    if (!options.allowLowContrast && (contrast(colors.text as string, colors.background as string) < 4.5 || contrast(colors.text as string, colors.surface as string) < 4.5)) throw new BadRequestException(`Text contrast must be at least 4.5:1 for ${mode}`);
  }
  for (const [group, keys] of Object.entries(numericGroups)) {
    const entries = t[group];
    if (!record(entries)) throw new BadRequestException(`Missing ${group} tokens`);
    exactKeys(entries, keys, group);
    for (const key of keys) { const n = entries[key]; const limit = group === "spacing" ? 64 : key === "pill" ? 999 : 128; if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > limit) throw new BadRequestException(`Out of range ${group}.${key}`); }
  }
  const typographyKeys = ["caption", "body", "bodyLarge", "title", "display", "hero"];
  if (!record(t.typography) || Object.keys(t.typography).some((key) => !typographyKeys.includes(key))) throw new BadRequestException("Unsupported typography token");
  if (typographyKeys.some((key) => !Object.hasOwn(t.typography as object, key))) throw new BadRequestException("All typography roles must be provided");
  for (const key of typographyKeys) {
    const item = t.typography[key]; if (!record(item) || Object.keys(item).some((k) => !["size", "lineHeight", "weight", "family"].includes(k)) || typeof item.size !== "number" || item.size < 10 || item.size > 64 || typeof item.lineHeight !== "number" || item.lineHeight < item.size || item.lineHeight > 96 || typeof item.weight !== "string" || !["400", "500", "600", "700", "800", "900"].includes(item.weight) || !["system", "display"].includes(String(item.family))) throw new BadRequestException(`Invalid typography.${key}`);
  }
  const opacity = t.opacity;
  const overlayOpacity = record(opacity) ? opacity.overlay : undefined;
  if (!record(opacity) || Object.keys(opacity).some((key) => !["disabled", "overlay"].includes(key)) || typeof opacity.disabled !== "number" || opacity.disabled < 0.2 || opacity.disabled > 0.7 || !record(overlayOpacity) || Object.keys(overlayOpacity).some((key) => !modes.includes(key as (typeof modes)[number])) || modes.some((mode) => typeof overlayOpacity[mode] !== "number" || (overlayOpacity[mode] as number) < 0 || (overlayOpacity[mode] as number) > 1)) throw new BadRequestException("Opacity values are out of range");
  if (!record(t.borders) || Object.keys(t.borders).some((key) => key !== "width") || typeof t.borders.width !== "number" || t.borders.width < 0 || t.borders.width > 4) throw new BadRequestException("Border width must be between 0 and 4");
  if (!record(t.elevation) || Object.keys(t.elevation).some((key) => !["card", "floating", "modal"].includes(key)) || [t.elevation.card, t.elevation.floating, t.elevation.modal].some((n) => typeof n !== "number" || n < 0 || n > 24)) throw new BadRequestException("Elevation must be between 0 and 24");
  if (!record(t.shadows) || Object.keys(t.shadows).some((key) => !modes.includes(key as (typeof modes)[number]))) throw new BadRequestException("Invalid shadows");
  for (const mode of modes) { const shadow = t.shadows[mode]; if (!record(shadow) || Object.keys(shadow).some((key) => !["color", "card", "floating", "modal", "cardRadius", "floatingRadius", "modalRadius"].includes(key)) || typeof shadow.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(shadow.color) || [shadow.card, shadow.floating, shadow.modal].some((entry) => typeof entry !== "number" || entry < 0 || entry > 0.35) || [shadow.cardRadius, shadow.floatingRadius, shadow.modalRadius].some((entry) => typeof entry !== "number" || entry < 0 || entry > 48)) throw new BadRequestException(`Invalid shadows.${mode}`); }
  for (const [group, allowed] of [["components", themeComponents], ["pages", themePages]] as const) {
    const overrides = t[group]; if (!record(overrides)) throw new BadRequestException(`Invalid ${group}`);
    exactKeys(overrides, allowed, group);
    for (const [name, values] of Object.entries(overrides)) {
      if (!record(values)) throw new BadRequestException(`Invalid ${group}.${name}`);
      const allowed = group === "pages" ? semanticColors : [...componentFields[name as keyof typeof componentFields].colors, ...componentFields[name as keyof typeof componentFields].numbers];
      exactKeys(values, allowed, `${group}.${name}`);
      for (const [key, entry] of Object.entries(values)) {
        const numeric = group === "components" && (componentFields[name as keyof typeof componentFields].numbers as readonly string[]).includes(key);
        const minimum = key === "height" ? 40 : 0;
        const maximum = key === "height" ? 88 : key === "radius" ? 999 : key === "borderWidth" ? 4 : 64;
        if (numeric ? typeof entry !== "number" || !Number.isFinite(entry) || entry < minimum || entry > maximum : typeof entry !== "string" || !(key === "overlay" ? /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(entry) : /^#[0-9a-fA-F]{6}$/.test(entry))) throw new BadRequestException(`Invalid override ${group}.${name}.${key}`);
      }
    }
  }
  if (t.pageComponents !== undefined) {
    if (!record(t.pageComponents)) throw new BadRequestException('Invalid pageComponents');
    exactKeys(t.pageComponents, themePages, 'pageComponents');
    for (const [page, fields] of Object.entries(t.pageComponents)) {
      const error = componentOverrideError(fields, `pageComponents.${page}`);
      if (error) throw new BadRequestException(`Invalid override ${error}`);
    }
  }
  const pageGroups = t.pageGroups ?? {};
  if (!record(pageGroups)) throw new BadRequestException("Invalid pageGroups");
  exactKeys(pageGroups, themePageGroups, "pageGroups");
  const assignedPages = new Set<string>();
  for (const [group, raw] of Object.entries(pageGroups)) {
    if (!record(raw) || Object.keys(raw).some((key) => !["pages", "colors", "followRegistry"].includes(key)) || raw.followRegistry !== undefined && typeof raw.followRegistry !== "boolean" || !Array.isArray(raw.pages) || !record(raw.colors)) throw new BadRequestException(`Invalid pageGroups.${group}`);
    if (new Set(raw.pages).size !== raw.pages.length || raw.pages.some((page) => typeof page !== "string" || !themePages.includes(page as (typeof themePages)[number]) || assignedPages.has(page))) throw new BadRequestException(`Invalid or duplicate pageGroups.${group}.pages`);
    for (const page of raw.pages) assignedPages.add(page as string);
    exactKeys(raw.colors, semanticColors, `pageGroups.${group}.colors`);
    for (const [key, color] of Object.entries(raw.colors)) if (typeof color !== "string" || !(key === "overlay" ? /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color) : /^#[0-9a-fA-F]{6}$/.test(color))) throw new BadRequestException(`Invalid pageGroups.${group}.colors.${key}`);
  }
  const ratio = (a: string, b: string) => {
    const lum = (hex: string) => { const rgb = hex.slice(1, 7).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2); return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; };
    const [high, low] = [lum(a), lum(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05);
  };
  const isBackgroundField = (field: string) => field === "background" || field.startsWith("background") || field.endsWith("Background");
  const foregroundFieldFor = (field: string) => field === "background" ? "foreground" : field.endsWith("Background") ? `${field.slice(0, -10)}Foreground` : "foreground";
  for (const [name, values] of Object.entries(t.components as Record<string, Record<string, unknown>>)) for (const [field, color] of Object.entries(values)) {
    if (!isBackgroundField(field) || typeof color !== "string" || name === "button" && field === "background" && typeof values.foreground !== "string") continue;
    const foreground = values[foregroundFieldFor(field)] ?? values.foreground ?? t.colors.light.text;
    if (!options.allowLowContrast && typeof foreground === "string" && ratio(color, foreground) < 4.5) throw new BadRequestException(`Text contrast must be at least 4.5:1 for components.${name}.${field}`);
  }
  for (const name of themePages) {
    const colors = { ...(t.colors.light as Record<string, string>), ...((t.pages as Record<string, Record<string, string>>)[name] ?? {}) };
    const components = (t.pageComponents as Record<string, ComponentOverrides> | undefined)?.[name] ?? {};
    for (const [key, fields] of Object.entries(components)) {
      const merged = { ...(t.components as Record<string, Record<string, string | number>>)[key], ...fields };
      for (const [field, color] of Object.entries(merged)) {
        if (!isBackgroundField(field) || typeof color !== 'string' || key === 'button' && field === 'background' && !merged.foreground) continue;
        const foreground = merged[foregroundFieldFor(field)] ?? merged.foreground ?? colors.text;
        if (!options.allowLowContrast && typeof foreground === 'string' && ratio(color, foreground) < 4.5) throw new BadRequestException(`Text contrast must be at least 4.5:1 for pageComponents.${name}.${key}.${field}`);
      }
    }
  }
  for (const name of themePages) for (const mode of modes) {
    const group = getThemePageGroup(pageGroups as Record<string, { pages: string[]; colors: Record<string, string>; followRegistry?: boolean }>, name);
    const merged = { ...(t.colors[mode] as Record<string, string>), ...(group?.colors ?? {}), ...((t.pages as Record<string, Record<string, string>>)[name] ?? {}) };
    if (!options.allowLowContrast && (ratio(merged.text, merged.background) < 4.5 || ratio(merged.text, merged.surface) < 4.5)) throw new BadRequestException(`Text contrast must be at least 4.5:1 for pages.${name}`);
  }
  return value as unknown as AppThemeDocument;
}
