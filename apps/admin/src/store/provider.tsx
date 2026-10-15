'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { adminStore, type AdminRootState, setTheme, toggleSidebar } from './store';

const STORAGE_KEY = 'brandly-admin-ui-v1';

function PersistAdminUi() {
  const dispatch = useDispatch();
  const ui = useSelector((state: AdminRootState) => state.ui);
  const hydrationStarted = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrationStarted.current) return;
    hydrationStarted.current = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      let theme: AdminRootState['ui']['theme'] = 'light';
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<typeof ui>;
        if (parsed.theme === 'light' || parsed.theme === 'dark') {
          theme = parsed.theme;
          dispatch(setTheme(parsed.theme));
        }
        if (typeof parsed.sidebarCollapsed === 'boolean' && parsed.sidebarCollapsed !== ui.sidebarCollapsed) {
          dispatch(toggleSidebar());
        }
      }
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = 'light';
    } finally {
      setHydrated(true);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = ui.theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: ui.theme, sidebarCollapsed: ui.sidebarCollapsed }));
    } catch {
      // Keep the selected theme usable if browser storage is disabled or full.
    }
  }, [hydrated, ui.theme, ui.sidebarCollapsed]);

  return null;
}

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  return <Provider store={adminStore}><PersistAdminUi />{children}</Provider>;
}
