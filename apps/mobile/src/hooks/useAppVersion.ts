import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { checkAppVersion, deferAppUpdate, type UpdateCheck } from '../services/appVersion.service';

export function useAppVersion() {
  const [update, setUpdate] = useState<UpdateCheck | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const runCheck = () => { void checkAppVersion().then((result) => setUpdate(result)); };
    runCheck();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') runCheck();
    });
    return () => subscription.remove();
  }, []);

  return {
    update: update?.shouldPrompt ? update : null,
    dismissOptional: () => {
      if (!update || update.required) return;
      setUpdate(null);
      void deferAppUpdate(update.latestVersion);
    },
  };
}
