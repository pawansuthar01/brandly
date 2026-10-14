import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useDispatch, useSelector } from 'react-redux';
import { AppTheme, ThemeMode, themes } from '../styles/theme';
import { setTheme, type MobileRootState } from '../store/store';
import { applyThemeDocument, readCachedTheme, refreshRemoteTheme, subscribeThemeRefresh, type ThemeDocument } from '../services/remoteTheme.service';
import { isValidTheme, resolveThemeContent } from '../lib/themeValidation';
import { THEME_SCREENS, type ThemeContentKey, type ThemeScreenId } from '../lib/themeScreens';

type ThemeContextValue = { theme: AppTheme; mode: ThemeMode; page: ThemeScreenId; setPage: (page: ThemeScreenId) => void; text: (key: ThemeContentKey, fallback: string) => string; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function isAdminThemePreview() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('adminThemePreview') === '1';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const preference = useSelector((state: MobileRootState) => state.preferences.theme);
  const systemScheme = useColorScheme();
  const [remote, setRemote] = useState<{ document: ThemeDocument; etag: string } | null>(null);
  const [page, setPage] = useState<ThemeScreenId>('home');
  const etag = useRef('');
  const remoteLoaded = useRef(false);
  const adminPreview = isAdminThemePreview();
  const safePreference: 'light' | 'dark' | 'system' = preference === 'dark' || preference === 'system' ? preference : 'light';
  const mode: ThemeMode = safePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : safePreference;
  const refresh = useCallback(() => { void refreshRemoteTheme(etag.current, (document, nextEtag) => { etag.current = nextEtag; setRemote({ document, etag: nextEtag }); }); }, []);
  useEffect(() => {
    if (adminPreview) {
      remoteLoaded.current = true;
      const receivePreview = (event: MessageEvent) => {
        const data = event.data;
        if (event.source !== window.parent || event.origin !== window.location.origin || data?.type !== 'brandly:admin-theme-preview' || !isValidTheme(data.theme, { allowLowContrast: true }) || !THEME_SCREENS.some((screen) => screen.id === data.screen) || (data.mode !== 'light' && data.mode !== 'dark') || typeof data.revision !== 'string' || data.revision.length > 100) return;
        setRemote({ document: data.theme, etag: `admin-preview:${data.revision}` });
        dispatch(setTheme(data.mode));
        setPage(data.screen);
      };
      window.addEventListener('message', receivePreview);
      window.parent.postMessage({ type: 'brandly:theme-preview-ready' }, window.location.origin);
      return () => window.removeEventListener('message', receivePreview);
    }
    let mounted = true;
    void readCachedTheme().then((cached) => {
      if (!mounted) return;
      if (cached && !remoteLoaded.current) { etag.current = cached.etag; setRemote({ document: cached.theme, etag: cached.etag }); }
      void refreshRemoteTheme(etag.current || cached?.etag || '', (document, nextEtag) => { if (mounted) { etag.current = nextEtag; remoteLoaded.current = true; setRemote({ document, etag: nextEtag }); } });
    });
    const unsubscribe = subscribeThemeRefresh(refresh);
    return () => { mounted = false; unsubscribe(); };
  }, [adminPreview, dispatch]);
  const theme = useMemo(() => remote ? applyThemeDocument(themes[mode], remote.document, mode, page) : themes[mode], [mode, page, remote]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);
  const value = useMemo(() => ({ theme, mode, page, setPage, text: (key: ThemeContentKey, fallback: string) => remote ? resolveThemeContent(remote.document, key, fallback) : fallback, toggleTheme: () => dispatch(setTheme(mode === 'light' ? 'dark' : 'light')) }), [dispatch, mode, page, remote, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
