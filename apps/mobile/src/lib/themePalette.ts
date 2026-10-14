import { resolveThemeColors, resolveThemeComponents, type ThemeDocument } from './themeValidation';
import type { AppTheme } from '../styles/theme';

export function resolveThemePalette(base: AppTheme['colors'], document: ThemeDocument, mode: 'light' | 'dark', page?: string): AppTheme['colors'] {
  const tokens = { ...document.tokens, components: resolveThemeComponents(document, page) };
  const colors = resolveThemeColors(document, mode, page);
  const componentColor = (component: Record<string, string | number> | undefined, key: string, fallback: string) => typeof component?.[key] === 'string' ? component[key] as string : fallback;
  const foreground = (background: string) => {
    const luminance = (hex: string) => hex.slice(1, 7).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const ratio = (a: string) => { const values = [luminance(a), luminance(background)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); };
    return ratio('#FFFFFF') >= ratio(mode === 'dark' ? '#201829' : '#2B2736') ? '#FFFFFF' : mode === 'dark' ? '#201829' : '#2B2736';
  };
  const surfaceChanged = colors.surface.toLowerCase() !== base.surface.toLowerCase();
  const backgroundChanged = colors.background.toLowerCase() !== base.background.toLowerCase();
  const gradients = document.tokens.gradients?.[mode];
  const textChanged = colors.text.toLowerCase() !== base.textPrimary.toLowerCase();
  const mutedChanged = colors.mutedText.toLowerCase() !== base.textSecondary.toLowerCase();
  const borderChanged = colors.border.toLowerCase() !== base.border.toLowerCase();
  const cardBackground = componentColor(tokens.components.card, 'background', surfaceChanged ? colors.surface : '');
  return {
    ...base,
    primary: colors.primary, secondary: colors.secondary, accent: colors.accent,
    background: colors.background,
    backgroundBrand: backgroundChanged ? colors.background : base.backgroundBrand,
    backgroundCreator: backgroundChanged ? colors.background : base.backgroundCreator,
    backgroundGradientTop: gradients?.top ?? (backgroundChanged ? colors.background : base.backgroundGradientTop),
    backgroundGradientRight: gradients?.right ?? (backgroundChanged ? colors.background : base.backgroundGradientRight),
    backgroundGradientBottom: gradients?.bottom ?? (backgroundChanged ? colors.background : base.backgroundGradientBottom),
    backgroundGradientLeft: gradients?.left ?? (backgroundChanged ? colors.background : base.backgroundGradientLeft),
    surface: colors.surface,
    surfaceRaised: cardBackground || base.surfaceRaised,
    surfaceHero: componentColor(tokens.components.card, 'backgroundHero', base.surfaceHero),
    surfaceMuted: componentColor(tokens.components.card, 'backgroundMuted', base.surfaceMuted),
    surfaceSky: componentColor(tokens.components.card, 'backgroundSky', base.surfaceSky),
    surfaceMint: componentColor(tokens.components.card, 'backgroundMint', base.surfaceMint),
    surfaceButter: componentColor(tokens.components.card, 'backgroundButter', base.surfaceButter),
    surfaceBlush: componentColor(tokens.components.card, 'backgroundBlush', base.surfaceBlush),
    surfaceLilac: componentColor(tokens.components.card, 'backgroundLilac', base.surfaceLilac),
    textPrimary: colors.text, textSecondary: colors.mutedText, border: colors.border,
    tertiaryText: textChanged ? colors.text : base.tertiaryText,
    inputPlaceholder: mutedChanged ? colors.mutedText : base.inputPlaceholder,
    inputBackground: componentColor(tokens.components.input, 'background', surfaceChanged ? colors.surface : base.inputBackground),
    cardBorder: componentColor(tokens.components.card, 'border', borderChanged ? colors.border : base.cardBorder),
    focus: colors.focus, success: colors.success, warning: colors.warning, danger: colors.error,
    overlay: `${colors.overlay.slice(0, 7)}${Math.round(tokens.opacity.overlay[mode] * 255).toString(16).padStart(2, '0')}`,
    primaryText: componentColor(tokens.components.button, 'foreground', foreground(componentColor(tokens.components.button, 'background', colors.primary))),
    secondaryText: colors.info !== base.secondaryText ? colors.info : colors.secondary === base.secondary ? (textChanged ? colors.text : base.secondaryText) : foreground(colors.secondary),
    accentText: colors.accent === base.accent ? base.accentText : foreground(colors.accent),
  };
}
