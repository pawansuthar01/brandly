import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { hydrateAuth, hydrateDemo, hydratePreferences, mobileStore, type MobileRootState } from './store';

const STORAGE_KEY = 'brandly-mobile-state-v3';
const MobileStoreHydrationContext = createContext(false);

function PersistMobileState({ children, preview }: { children: ReactNode; preview: boolean }) {
  const dispatch = useDispatch();
  const [hydrated, setHydrated] = useState(false);
  const demo = useSelector((root: MobileRootState) => root.demo);
  const auth = useSelector((root: MobileRootState) => root.auth);
  const preferences = useSelector((root: MobileRootState) => root.preferences);
  const state = useMemo(
    () => ({ demo, auth, preferences }),
    [auth, demo, preferences],
  );
  const firstWrite = useRef(true);
  const writeQueue = useRef(Promise.resolve());
  const latestState = useRef(state);
  latestState.current = state;
  const writeState = () => {
    if (preview || firstWrite.current) return;
    const serializedState = JSON.stringify(latestState.current);
    writeQueue.current = writeQueue.current.catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, serializedState)).catch(() => undefined);
  };
  const writeStateRef = useRef(writeState);
  writeStateRef.current = writeState;
  useEffect(() => {
    if (preview) { setHydrated(true); return; }
    const subscription = AppState.addEventListener('change', (next) => { if (next !== 'active') writeStateRef.current(); });
    return () => { subscription.remove(); writeStateRef.current(); };
  }, [preview]);

  useEffect(() => {
    if (preview) { firstWrite.current = false; setHydrated(true); return; }
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!active) return;
      if (value) {
        try {
          const parsed = JSON.parse(value) as Partial<MobileRootState>;
          if (parsed.demo) dispatch(hydrateDemo(parsed.demo));
          if (parsed.auth) dispatch(hydrateAuth(parsed.auth));
          if (parsed.preferences) {
            dispatch(hydratePreferences({
              ...parsed.preferences,
              theme: parsed.preferences.theme === 'system' ? 'light' : parsed.preferences.theme,
            }));
          }
        } catch {
          void AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      firstWrite.current = false;
      setHydrated(true);
    }).catch(() => {
      firstWrite.current = false;
      setHydrated(true);
    });
    return () => { active = false; };
  }, [dispatch, preview]);

  useEffect(() => {
    if (preview || !hydrated || firstWrite.current) return;
    const timer = setTimeout(() => writeStateRef.current(), 250);
    return () => clearTimeout(timer);
  }, [hydrated, preview, state]);

  return <MobileStoreHydrationContext.Provider value={preview || hydrated}>{children}</MobileStoreHydrationContext.Provider>;
}

export function MobileStoreProvider({ children, preview = false }: { children: ComponentProps<typeof Provider>['children']; preview?: boolean }) {
  return <Provider store={mobileStore}><PersistMobileState preview={preview}>{children}</PersistMobileState></Provider>;
}

export function useMobileStoreHydrated() { return useContext(MobileStoreHydrationContext); }
