export type ThemeMode = 'light' | 'dark';

export const foundation = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 },
  radius: { sm: 10, md: 16, lg: 22, pill: 999 },
  type: { caption: 12, body: 14, bodyLarge: 16, title: 20, display: 28, hero: 38 },
};

const lightColors = {
  background: '#F5F7FB', surface: '#FFFFFF', surfaceMuted: '#EEF3FA', transparent: 'transparent', textPrimary: '#152033', textSecondary: '#66758A', border: '#D9E2EE', primary: '#2563EB', primaryText: '#FFFFFF', accent: '#DCEBFF', accentText: '#1D4ED8', success: '#16825D', danger: '#C13E4A', overlay: '#15203399'
};

const darkColors = {
  background: '#101114', surface: '#191A1E', surfaceMuted: '#23252B', transparent: 'transparent', textPrimary: '#F4F5F7', textSecondary: '#C1C5CE', border: '#33363D', primary: '#91A9FF', primaryText: '#101114', accent: '#29364C', accentText: '#B9C9FF', success: '#6BD2A7', danger: '#FF98A1', overlay: '#000000B8'
};

export const themes = {
  light: { ...foundation, colors: lightColors },
  dark: { ...foundation, colors: darkColors },
};

export type AppTheme = (typeof themes)['light'];
