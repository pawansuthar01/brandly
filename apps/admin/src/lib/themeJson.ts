import {
  isValidTheme,
  type ThemeDocument,
} from "../../../mobile/src/lib/themeValidation";
import {
  THEME_PAGE_GROUPS,
  THEME_SCREENS,
  THEME_COMPONENTS,
  THEME_CONTENT_FIELDS,
  getThemePageGroup,
  componentOverrideError,
} from "../../../mobile/src/lib/themeScreens";

const maxBytes = 256 * 1024;
const colors = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "mutedText",
  "border",
  "focus",
  "overlay",
  "success",
  "warning",
  "error",
  "info",
];
const roles = ["caption", "body", "bodyLarge", "title", "display", "hero"];
const components = Object.fromEntries(
  Object.entries(THEME_COMPONENTS).map(([key, spec]) => [
    key,
    [...spec.colors, ...spec.numbers],
  ]),
);
const allowedKeys = (path: string[]) => {
  const at = path.join(".");
  if (at === "") return ["schemaVersion", "name", "content", "tokens"];
  if (at === "content") return THEME_CONTENT_FIELDS.map(({ id }) => id);
  if (at === "tokens")
    return [
      "colors",
      "gradients",
      "typography",
      "spacing",
      "radius",
      "opacity",
      "borders",
      "elevation",
      "shadows",
      "components",
      "pages",
      "pageGroups",
      "pageComponents",
    ];
  if (at === "tokens.colors") return ["light", "dark"];
  if (/^tokens\.colors\.(light|dark)$/.test(at)) return colors;
  if (at === "tokens.gradients") return ["light", "dark"];
  if (/^tokens\.gradients\.(light|dark)$/.test(at))
    return ["top", "right", "bottom", "left"];
  if (at === "tokens.typography") return roles;
  if (/^tokens\.typography\./.test(at))
    return ["size", "lineHeight", "weight", "family"];
  if (at === "tokens.spacing") return ["xs", "sm", "md", "lg", "xl", "xxl"];
  if (at === "tokens.radius") return ["sm", "control", "md", "lg", "pill"];
  if (at === "tokens.opacity") return ["disabled", "overlay"];
  if (at === "tokens.opacity.overlay") return ["light", "dark"];
  if (at === "tokens.borders") return ["width"];
  if (at === "tokens.elevation") return ["card", "floating", "modal"];
  if (at === "tokens.shadows") return ["light", "dark"];
  if (/^tokens\.shadows\.(light|dark)$/.test(at))
    return [
      "color",
      "card",
      "floating",
      "modal",
      "cardRadius",
      "floatingRadius",
      "modalRadius",
    ];
  if (at === "tokens.components") return Object.keys(components);
  if (/^tokens\.components\./.test(at)) return components[path[2]] ?? [];
  if (at === "tokens.pageComponents") return THEME_SCREENS.map(({ id }) => id);
  if (/^tokens\.pageComponents\.[^.]+$/.test(at))
    return Object.keys(components);
  if (/^tokens\.pageComponents\.[^.]+\.[^.]+$/.test(at))
    return components[path[3]] ?? [];
  if (at === "tokens.pages") return THEME_SCREENS.map(({ id }) => id);
  if (/^tokens\.pages\./.test(at)) return colors;
  if (at === "tokens.pageGroups") return THEME_PAGE_GROUPS.map(({ id }) => id);
  if (/^tokens\.pageGroups\.[^.]+$/.test(at))
    return ["pages", "colors", "followRegistry"];
  if (/^tokens\.pageGroups\.[^.]+\.colors$/.test(at)) return colors;
  return undefined;
};

function findUnknown(value: unknown, path: string[] = []): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value))
    return value
      .map((entry, index) => findUnknown(entry, [...path, String(index)]))
      .find(Boolean);
  const keys = allowedKeys(path);
  for (const [key, child] of Object.entries(value)) {
    if (keys && !keys.includes(key)) return [...path, key].join(".") || "$";
    const invalid = findUnknown(child, [...path, key]);
    if (invalid) return invalid;
  }
  return undefined;
}

function findUnsafeText(
  value: unknown,
  path: string[] = [],
): string | undefined {
  if (
    typeof value === "string" &&
    /<\s*\/?\s*[a-z!][^>]*>|javascript:|url\s*\(|expression\s*\(|@import/i.test(
      value,
    )
  )
    return path.join(".") || "$";
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    const invalid = findUnsafeText(child, [...path, key]);
    if (invalid) return invalid;
  }
  return undefined;
}

function firstValueError(value: Record<string, any>): string {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "theme";
  if (value.schemaVersion !== 1) return "theme.schemaVersion";
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80
  )
    return "theme.name";
  for (const mode of ["light", "dark"])
    for (const key of colors)
      if (
        typeof value.tokens?.colors?.[mode]?.[key] !== "string" ||
        !(
          key === "overlay" ? /^#[\da-f]{6}([\da-f]{2})?$/i : /^#[\da-f]{6}$/i
        ).test(value.tokens.colors[mode][key])
      )
        return `theme.tokens.colors.${mode}.${key}`;
  const componentError = componentOverrideError(
    value.tokens?.components,
    "theme.tokens.components",
  );
  if (componentError) return componentError;
  for (const group of ["spacing", "radius"] as const)
    for (const key of group === "spacing"
      ? ["xs", "sm", "md", "lg", "xl", "xxl"]
      : ["sm", "control", "md", "lg", "pill"])
      if (typeof value.tokens?.[group]?.[key] !== "number")
        return `theme.tokens.${group}.${key}`;
  for (const group of ["spacing", "radius"] as const)
    for (const [key, n] of Object.entries(value.tokens?.[group] ?? {})) {
      const max = group === "spacing" ? 64 : key === "pill" ? 999 : 128;
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max)
        return `theme.tokens.${group}.${key}`;
    }
  for (const role of roles)
    if (!value.tokens?.typography?.[role])
      return `theme.tokens.typography.${role}`;
  for (const [role, raw] of Object.entries(value.tokens?.typography ?? {})) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return `theme.tokens.typography.${role}`;
    const type = raw as Record<string, unknown>;
    if (typeof type.size !== "number" || type.size < 10 || type.size > 64)
      return `theme.tokens.typography.${role}.size`;
    if (
      typeof type.lineHeight !== "number" ||
      type.lineHeight < type.size ||
      type.lineHeight > 96
    )
      return `theme.tokens.typography.${role}.lineHeight`;
    if (
      typeof type.weight !== "string" ||
      !["400", "500", "600", "700", "800", "900"].includes(type.weight)
    )
      return `theme.tokens.typography.${role}.weight`;
    if (!["system", "display"].includes(String(type.family)))
      return `theme.tokens.typography.${role}.family`;
  }
  for (const [page, fields] of Object.entries(
    value.tokens?.pageComponents ?? {},
  )) {
    const error = componentOverrideError(
      fields,
      `theme.tokens.pageComponents.${page}`,
    );
    if (error) return error;
  }
  const hexColor = /^#[\da-f]{6}$/i;
  for (const [page, fields] of Object.entries(value.tokens?.pages ?? {})) {
    if (!THEME_SCREENS.some((screen) => screen.id === page))
      return `theme.tokens.pages.${page}`;
    if (!fields || typeof fields !== "object" || Array.isArray(fields))
      return `theme.tokens.pages.${page}`;
    for (const [key, color] of Object.entries(
      fields as Record<string, unknown>,
    ))
      if (
        typeof color !== "string" ||
        !(key === "overlay" ? /^#[\da-f]{6}([\da-f]{2})?$/i : hexColor).test(
          color,
        )
      )
        return `theme.tokens.pages.${page}.${key}`;
  }
  for (const [group, entry] of Object.entries(value.tokens?.pageGroups ?? {})) {
    if (!THEME_PAGE_GROUPS.some((item) => item.id === group))
      return `theme.tokens.pageGroups.${group}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return `theme.tokens.pageGroups.${group}`;
    const item = entry as {
      pages?: unknown;
      colors?: unknown;
      followRegistry?: unknown;
    };
    if (
      !Array.isArray(item.pages) ||
      item.pages.some(
        (page) => !THEME_SCREENS.some((screen) => screen.id === page),
      ) ||
      new Set(item.pages).size !== item.pages.length
    )
      return `theme.tokens.pageGroups.${group}.pages`;
    if (
      item.followRegistry !== undefined &&
      typeof item.followRegistry !== "boolean"
    )
      return `theme.tokens.pageGroups.${group}.followRegistry`;
    if (
      !item.colors ||
      typeof item.colors !== "object" ||
      Array.isArray(item.colors)
    )
      return `theme.tokens.pageGroups.${group}.colors`;
    for (const [key, color] of Object.entries(
      (entry as { colors?: Record<string, unknown> })?.colors ?? {},
    ))
      if (
        typeof color !== "string" ||
        !(key === "overlay" ? /^#[\da-f]{6}([\da-f]{2})?$/i : hexColor).test(
          color,
        )
      )
        return `theme.tokens.pageGroups.${group}.colors.${key}`;
  }
  const ratio = (a: string, b: string) => {
    const luminance = (hex: string) =>
      hex
        .slice(1, 7)
        .match(/.{2}/g)!
        .map((part) => parseInt(part, 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2))
        .reduce(
          (sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a);
    return (high + 0.05) / (low + 0.05);
  };
  for (const [component, fields] of Object.entries(
    value.tokens?.components ?? {},
  )) {
    for (const [key, background] of Object.entries(
      fields as Record<string, string | number>,
    )) {
      if (
        !(
          key === "background" ||
          key.startsWith("background") ||
          key.endsWith("Background")
        ) ||
        typeof background !== "string"
      )
        continue;
      const foregroundKey =
        key === "background"
          ? "foreground"
          : key.endsWith("Background")
            ? `${key.slice(0, -10)}Foreground`
            : "foreground";
      const foreground = String(
        (fields as Record<string, string | number>)[foregroundKey] ??
          (fields as Record<string, string | number>).foreground ??
          value.tokens.colors.light.text,
      );
      if (
        !(
          component === "button" &&
          key === "background" &&
          !(fields as Record<string, string | number>).foreground
        ) &&
        ratio(foreground, background) < 4.5
      )
        return `theme.tokens.components.${component}.${key} (needs 4.5:1 text contrast)`;
    }
  }
  for (const mode of ["light", "dark"] as const) {
    const color = value.tokens?.colors?.[mode];
    if (
      color &&
      (ratio(color.text, color.background) < 4.5 ||
        ratio(color.text, color.surface) < 4.5)
    )
      return `theme.tokens.colors.${mode}.text (needs 4.5:1 contrast against background and surface)`;
  }
  for (const [page, entries] of Object.entries(
    value.tokens?.pageComponents ?? {},
  )) {
    for (const [component, fields] of Object.entries(
      entries as Record<string, Record<string, string | number>>,
    )) {
      const merged = { ...value.tokens.components[component], ...fields };
      const shared = getThemePageGroup(value.tokens?.pageGroups ?? {}, page) as
        | { colors?: Record<string, string> }
        | undefined;
      const pageText = value.tokens.colors.light.text;
      const foregroundFallback =
        value.tokens.pages?.[page]?.text ?? shared?.colors?.text ?? pageText;
      for (const [key, background] of Object.entries(merged)) {
        if (
          !(
            key === "background" ||
            key.startsWith("background") ||
            key.endsWith("Background")
          ) ||
          typeof background !== "string"
        )
          continue;
        const foregroundKey =
          key === "background"
            ? "foreground"
            : key.endsWith("Background")
              ? `${key.slice(0, -10)}Foreground`
              : "foreground";
        const foreground = String(
          merged[foregroundKey] ?? merged.foreground ?? foregroundFallback,
        );
        if (
          !(
            component === "button" &&
            key === "background" &&
            !merged.foreground
          ) &&
          ratio(foreground, background) < 4.5
        )
          return `theme.tokens.pageComponents.${page}.${component}.${key} (needs 4.5:1 text contrast)`;
      }
    }
  }
  for (const page of THEME_SCREENS)
    for (const mode of ["light", "dark"] as const) {
      const shared = getThemePageGroup(
        value.tokens?.pageGroups ?? {},
        page.id,
      ) as { colors?: Record<string, string> } | undefined;
      const color = {
        ...value.tokens.colors[mode],
        ...shared?.colors,
        ...value.tokens.pages?.[page.id],
      };
      if (
        ratio(color.text, color.background) < 4.5 ||
        ratio(color.text, color.surface) < 4.5
      )
        return `theme.tokens.pages.${page.id} (needs 4.5:1 text contrast)`;
    }
  return "theme.tokens (unsupported value, numeric range, or text contrast)";
}

export function parseThemeJson(text: string): ThemeDocument {
  if (new TextEncoder().encode(text).byteLength > maxBytes)
    throw new Error("theme: JSON file exceeds the 256 KB import limit");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("theme: invalid JSON syntax");
  }
  const unsafe = findUnsafeText(value);
  if (unsafe)
    throw new Error(
      `${unsafe}: executable code, HTML, and CSS are not allowed in a theme`,
    );
  const extra = findUnknown(value);
  if (extra) throw new Error(`${extra}: unsupported field`);
  if (!isValidTheme(value, { allowLowContrast: true }))
    throw new Error(
      `${firstValueError(value as Record<string, any>)}: invalid token value, range, or screen ID`,
    );
  return value;
}

export function themeContrastWarning(theme: unknown): string {
  if (!isValidTheme(theme, { allowLowContrast: true })) return "";
  const detail = firstValueError(theme as Record<string, any>);
  if (!detail.includes("(needs 4.5:1")) return "";
  return `${detail}: text and its background/surface need at least 4.5:1 contrast.`;
}

export function exportThemeJson(theme: unknown): string {
  return `${JSON.stringify(theme, null, 2)}\n`;
}

type EditableTypography = {
  tokens: {
    typography: Record<
      string,
      { size: number; lineHeight: number; weight: string; family: string }
    >;
  };
};

export function updateTypographyToken<T extends EditableTypography>(
  theme: T,
  role: string,
  field: "size" | "lineHeight",
  value: number,
): T {
  const current = theme.tokens.typography[role];
  const size = field === "size" ? value : current.size;
  const lineHeight =
    field === "lineHeight"
      ? Math.max(value, size)
      : Math.max(current.lineHeight, size);
  return {
    ...theme,
    tokens: {
      ...theme.tokens,
      typography: {
        ...theme.tokens.typography,
        [role]: { ...current, size, lineHeight },
      },
    },
  } as T;
}
