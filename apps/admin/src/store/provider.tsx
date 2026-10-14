'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { adminStore, type AdminRootState, setTheme, toggleSidebar } from './store';

const STORAGE_KEY = 'brandly-admin-ui-v1';

function PersistAdminUi() {
  const dispatch = useDispatch();
  const ui = useSelector((state: AdminRootState) => state.ui);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<typeof ui>;
        if (parsed.theme === 'light' || parsed.theme === 'dark') dispatch(setTheme(parsed.theme));
        if (typeof parsed.sidebarCollapsed === 'boolean' && parsed.sidebarCollapsed !== ui.sidebarCollapsed) {
          dispatch(toggleSidebar());
        }
        document.documentElement.dataset.theme = parsed.theme === 'dark' ? 'dark' : 'light';
      } else {
        document.documentElement.dataset.theme = 'light';
      }
    } catch {
      document.documentElement.dataset.theme = 'light';
    } finally {
      // Theme changes must work even when localStorage is empty or unavailable.
      hydrated.current = true;
    }
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated.current) return;
    document.documentElement.dataset.theme = ui.theme;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: ui.theme, sidebarCollapsed: ui.sidebarCollapsed }));
  }, [ui]);

  return null;
}

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  return <Provider store={adminStore}><PersistAdminUi />{children}</Provider>;
}
