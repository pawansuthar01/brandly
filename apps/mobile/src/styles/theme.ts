import { Platform } from 'react-native';
import { surfaceColors } from './surfaceColors';

export type ThemeMode = 'light' | 'dark';

const bodyFont = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) ?? 'System';
const displayFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) ?? 'Georgia';

export const foundation = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 },
  radius: { sm: 12, control: 16, md: 20, lg: 28, pill: 999 },
  type: {
    caption: 12,
    body: 15,
    bodyLarge: 16,
    title: 20,
    display: 30,
    hero: 38,
    lineHeight: {
      caption: 18,
      body: 22,
      bodyLarge: 24,
      title: 28,
      display: 36,
      hero: 44,
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extraBold: '800',
      black: '900',
    } as const,
    roleWeights: { caption: '400', body: '400', bodyLarge: '400', title: '700', display: '700', hero: '700' },
    roleFonts: { caption: bodyFont, body: bodyFont, bodyLarge: bodyFont, title: bodyFont, display: displayFont, hero: displayFont },
    bodyFont,
    displayFont,
  },
};

const lightColors = {
  background: '#E9EEFB',
  backgroundCreator: '#E2EEF8',
  backgroundBrand: '#E5EFF9',
  backgroundGradientTop: '#E9EEFB',
  backgroundGradientRight: '#E2EEF8',
  backgroundGradientBottom: '#E5EFF9',
  backgroundGradientLeft: '#DBECF3',
  ...surfaceColors.light,
  transparent: 'transparent',
  textPrimary: '#2B2736',
  textSecondary: '#777486',
  border: '#E2E2EB',
  cardBorder: '#EAE9EF',
  inputBackground: '#FAF9F6',
  inputPlaceholder: '#9B98A8',
  focus: '#A9ABF3',
  disabled: '#C9C6D2',
  primary: '#5C5FC1',
  primaryText: '#FFFFFF',
  accent: '#B0B2F4',
  accentText: '#5C5FC1',
  secondary: '#C2E0FD',
  secondaryText: '#426B75',
  tertiary: '#FED8B7',
  tertiaryText: '#7D5942',
  success: '#1C876F',
  successText: '#FFFFFF',
  warning: '#D97706',
  warningSurface: '#FFF1D6',
  danger: '#C65A66',
  overlay: '#2B273699',
};

const darkColors = {
  background: '#16141D',
  backgroundCreator: '#171525',
  backgroundBrand: '#121A24',
  backgroundGradientTop: '#16141D',
  backgroundGradientRight: '#1C2432',
  backgroundGradientBottom: '#182B31',
  backgroundGradientLeft: '#20253B',
  ...surfaceColors.dark,
  transparent: 'transparent',
  textPrimary: '#F7F4FF',
  textSecondary: '#C4BED0',
  border: '#464056',
  cardBorder: '#40394D',
  inputBackground: '#2A2637',
  inputPlaceholder: '#AFA9BD',
  focus: '#BBA8FF',
  disabled: '#575064',
  primary: '#BBA8FF',
  primaryText: '#201829',
  accent: '#423C67',
  accentText: '#EDE9FF',
  secondary: '#5D8F9B',
  secondaryText: '#D6F0F3',
  tertiary: '#A97858',
  tertiaryText: '#FFE2CF',
  success: '#7EE2C0',
  successText: '#FFFFFF',
  warning: '#FFB454',
  warningSurface: '#4A3520',
  danger: '#FF9EA9',
  overlay: '#000000C7',
};

const componentTokens: Record<string, Record<string, string | number>> = {
  button: {}, input: {}, card: {}, appBar: {}, navigation: {}, tabs: {}, list: {},
  badge: {}, dialog: {}, alert: {}, chip: {},
};

export const themes = {
  light: {
    ...foundation,
    colors: lightColors,
    components: componentTokens,
    opacity: { disabled: 0.48, overlay: { light: 0.6, dark: 0.78 } },
    borders: { width: 1 },
    shadows: {
      card: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
      floating: { shadowColor: '#2B2736', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
      modal: { shadowColor: '#2B2736', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
    },
  },
  dark: {
    ...foundation,
    colors: darkColors,
    components: componentTokens,
    opacity: { disabled: 0.48, overlay: { light: 0.6, dark: 0.78 } },
    borders: { width: 1 },
    shadows: {
      card: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
      floating: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 1 },
      modal: { shadowColor: '#000000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 3 },
    },
  },
};

export type AppTheme = (typeof themes)['light'];
