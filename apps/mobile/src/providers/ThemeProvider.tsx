import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { AppTheme, ThemeMode, themes } from '../styles/theme';

type ThemeContextValue = { theme: AppTheme; mode: ThemeMode; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const value = useMemo(() => ({ theme: themes[mode], mode, toggleTheme: () => setMode((current) => current === 'light' ? 'dark' : 'light') }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
