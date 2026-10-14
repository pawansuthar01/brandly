import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { foundation, type AppTheme } from './theme';

const roles = ['caption', 'body', 'bodyLarge', 'title', 'display', 'hero'] as const;

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function createThemeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  theme: AppTheme,
  styles: T & NamedStyles<any>,
): T {
  const mapped = Object.fromEntries(Object.entries(styles).map(([name, style]) => {
    const text = style as TextStyle;
    const role = roles.find((key) => text.fontSize === theme.type[key]);
    if (!role) return [name, style];
    const next = { ...style } as TextStyle;
    if (theme.type.roleWeights[role] !== foundation.type.roleWeights[role]) next.fontWeight = theme.type.roleWeights[role] as TextStyle['fontWeight'];
    if (theme.type.lineHeight[role] !== foundation.type.lineHeight[role]) next.lineHeight = theme.type.lineHeight[role];
    if (theme.type.roleFonts[role] !== foundation.type.roleFonts[role]) next.fontFamily = theme.type.roleFonts[role];
    return [name, next];
  })) as T;
  return StyleSheet.create(mapped);
}
