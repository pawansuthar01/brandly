import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { API_BASE_URLS } from "../config/api";
import { foundation, themes, type AppTheme } from "../styles/theme";
import { isValidTheme, resolveThemeComponents, type ThemeDocument } from "../lib/themeValidation";
import { resolveThemePalette } from "../lib/themePalette";
import { createThemeRefresher, type RemoteTheme } from "./themeRefresh";
export type { ThemeDocument } from "../lib/themeValidation";

const CACHE_KEY = "brandly-published-theme-v1";
type Cached = { etag: string; theme: ThemeDocument };

export function applyThemeDocument(base: AppTheme, document: ThemeDocument, mode: "light" | "dark", page?: string): AppTheme {
  const tokens = document.tokens;
  const themeColors = resolveThemePalette(base.colors, document, mode, page);
  const type = { ...foundation.type, lineHeight: { ...foundation.type.lineHeight }, weight: { ...foundation.type.weight } };
  for (const key of ["caption", "body", "bodyLarge", "title", "display", "hero"] as const) {
    const token = tokens.typography[key]; if (!token) continue;
    type[key] = token.size;
    type.lineHeight[key] = token.lineHeight;
  }
  type.bodyFont = tokens.typography.body.family === "display" ? foundation.type.displayFont : foundation.type.bodyFont;
  type.displayFont = tokens.typography.display.family === "system" ? foundation.type.bodyFont : foundation.type.displayFont;
  type.roleWeights = Object.fromEntries(Object.entries(tokens.typography).map(([key, token]) => [key, token.weight])) as typeof type.roleWeights;
  type.roleFonts = Object.fromEntries(Object.entries(tokens.typography).map(([key, token]) => [key, token.family === "display" ? foundation.type.displayFont : foundation.type.bodyFont])) as typeof type.roleFonts;
  const weight = (role: string, fallback: string) => tokens.typography[role]?.weight ?? fallback;
  type.weight = { regular: weight("caption", "400"), medium: weight("body", "500"), semibold: weight("bodyLarge", "600"), bold: weight("title", "700"), extraBold: weight("display", "800"), black: weight("hero", "900") } as unknown as typeof type.weight;
  return {
    ...base, colors: themeColors,
    components: { ...base.components, ...resolveThemeComponents(document, page) },
    opacity: tokens.opacity,
    borders: tokens.borders,
    spacing: { ...base.spacing, ...tokens.spacing },
    radius: { ...base.radius, ...tokens.radius },
    type,
    shadows: {
      card: { ...base.shadows.card, shadowColor: tokens.shadows[mode].color, shadowOpacity: tokens.shadows[mode].card, shadowRadius: tokens.shadows[mode].cardRadius, elevation: tokens.elevation.card },
      floating: { ...base.shadows.floating, shadowColor: tokens.shadows[mode].color, shadowOpacity: tokens.shadows[mode].floating, shadowRadius: tokens.shadows[mode].floatingRadius, elevation: tokens.elevation.floating },
      modal: { ...base.shadows.modal, shadowColor: tokens.shadows[mode].color, shadowOpacity: tokens.shadows[mode].modal, shadowRadius: tokens.shadows[mode].modalRadius, elevation: tokens.elevation.modal },
    },
  } as AppTheme;
}

export async function readCachedTheme(): Promise<Cached | null> {
  try { const value = await AsyncStorage.getItem(CACHE_KEY); const parsed = value ? JSON.parse(value) as Cached : null; return parsed && isValidTheme(parsed.theme) && typeof parsed.etag === "string" ? parsed : null; } catch { return null; }
}

async function requestRemoteTheme(etag: string): Promise<Cached | null> {
  for (const base of API_BASE_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${base}/app-themes/active`, { headers: etag ? { "If-None-Match": etag } : {}, signal: controller.signal });
      if (response.status === 304) return null;
      if (!response.ok) continue;
      const payload = await response.json() as { theme?: unknown };
      if (!isValidTheme(payload.theme)) continue;
      return { etag: response.headers.get("etag") ?? "", theme: payload.theme };
    } catch { /* Try the next configured API; callers keep the last valid theme. */ }
    finally { clearTimeout(timeout); }
  }
  return null;
}

export const refreshRemoteTheme = createThemeRefresher(
  requestRemoteTheme,
  (remote: RemoteTheme) => AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote)),
  isValidTheme,
);

export function subscribeThemeRefresh(refresh: () => void) {
  const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
  return () => subscription.remove();
}
