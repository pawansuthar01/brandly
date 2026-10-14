import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { DownloadTask, File, Paths, type DownloadPauseState } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import { API_BASE_URL } from '../config/api';
import { withTimeout } from './authApi.service';

export type UpdateMode = 'none' | 'optional' | 'mandatory';

export type AppVersionConfig = {
  platform: 'android' | 'ios';
  minimumVersion: string;
  latestVersion: string;
  mode: UpdateMode;
  sourceType: 'apk' | 'playStore' | 'appStore';
  message: string;
  releaseNotes: string[];
  storeUrl: string;
};

const VERSION_CACHE_KEY = 'brandly-app-version-config-v1';
const UPDATE_DEFER_KEY = 'brandly-app-version-defer-v1';
const APK_DOWNLOAD_KEY = 'brandly-apk-download-v2';
const APK_DOWNLOAD_ATTEMPTS = 3;
const UPDATE_REMINDER_MS = 24 * 60 * 60 * 1000;
const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.1.0';

type ApkDownloadRecord = {
  url: string;
  version: string;
  destinationUri: string;
  bytesWritten: number;
  totalBytes: number;
  pausedState?: DownloadPauseState;
};

async function getRemoteVersionConfig(): Promise<AppVersionConfig> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const response = await withTimeout(
    fetch(`${API_BASE_URL}/app-config/version?platform=${platform}`),
    8000,
    'Version settings request timed out',
  );
  if (!response.ok) throw new Error('Version settings request failed');
  const value = await response.json() as Partial<AppVersionConfig>;
  if (
    value.platform !== platform ||
    typeof value.minimumVersion !== 'string' ||
    typeof value.latestVersion !== 'string' ||
    (value.mode !== 'none' && value.mode !== 'optional' && value.mode !== 'mandatory') ||
    (value.sourceType !== 'apk' && value.sourceType !== 'playStore' && value.sourceType !== 'appStore') ||
    typeof value.storeUrl !== 'string' ||
    !isAllowedStoreUrl(platform, value.storeUrl)
  ) throw new Error('Invalid version settings');
  return {
    platform,
    minimumVersion: value.minimumVersion,
    latestVersion: value.latestVersion,
    mode: value.mode,
    sourceType: value.sourceType,
    message: typeof value.message === 'string' ? value.message : 'A newer version of Brandly is available.',
    releaseNotes: Array.isArray(value.releaseNotes) ? value.releaseNotes.filter((note): note is string => typeof note === 'string') : [],
    storeUrl: value.storeUrl,
  };
}

export async function downloadAndInstallApk(
  url: string,
  version: string,
  onProgress?: (progress: number) => void,
  onReady?: () => void,
): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('Direct APK installation is available on Android only.');
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.pathname.toLowerCase().endsWith('.apk')) {
    throw new Error('The Android update link is not a secure APK URL.');
  }
  const safeVersion = version.replace(/[^a-z0-9.-]/gi, '-');
  const destination = new File(Paths.cache, `brandly-${safeVersion}.apk`);

  const storedRecord = await readApkDownloadRecord(url, version, destination.uri);
  let resumeState = storedRecord?.pausedState;
  if (storedRecord && storedRecord.totalBytes > 0) {
    onProgress?.(Math.min(1, storedRecord.bytesWritten / storedRecord.totalBytes));
  } else if (!resumeState && destination.exists) {
    destination.delete();
  }

  let latestBytesWritten = storedRecord?.bytesWritten ?? 0;
  let latestTotalBytes = storedRecord?.totalBytes ?? -1;
  let lastPersistedAt = 0;
  let persistChain = Promise.resolve();
  let activeTask: DownloadTask | null = null;
  let pauseChain: Promise<void> | null = null;
  let resolveForeground: (() => void) | null = null;

  const persist = (pausedState?: DownloadPauseState) => {
    const record: ApkDownloadRecord = {
      url,
      version,
      destinationUri: destination.uri,
      bytesWritten: latestBytesWritten,
      totalBytes: latestTotalBytes,
      ...(pausedState ? { pausedState } : {}),
    };
    persistChain = persistChain.then(() => AsyncStorage.setItem(APK_DOWNLOAD_KEY, JSON.stringify(record))).catch(() => undefined);
    return persistChain;
  };

  const reportProgress = (bytesWritten: number, totalBytes: number) => {
    latestBytesWritten = bytesWritten;
    latestTotalBytes = totalBytes;
    if (totalBytes > 0) onProgress?.(Math.min(1, bytesWritten / totalBytes));
    if (Date.now() - lastPersistedAt >= 500) {
      lastPersistedAt = Date.now();
      void persist();
    }
  };

  const waitForForeground = () => {
    if (AppState.currentState === 'active') return Promise.resolve();
    return new Promise<void>((resolve) => { resolveForeground = resolve; });
  };

  const appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      resolveForeground?.();
      resolveForeground = null;
      return;
    }
    if (nextState !== 'background' || !activeTask || activeTask.state !== 'active' || pauseChain) return;
    const task = activeTask;
    pauseChain = task.pauseAsync()
      .then(async () => {
        resumeState = task.savable();
        await persist(resumeState);
      })
      .catch(() => undefined)
      .finally(() => { pauseChain = null; });
  });

  let lastError: unknown = null;
  try {
    for (let attempt = 1; attempt <= APK_DOWNLOAD_ATTEMPTS; attempt += 1) {
      let task: DownloadTask | null = null;
      try {
        task = resumeState
          ? DownloadTask.fromSavable(resumeState, {
              sessionType: 'background',
              onProgress: ({ bytesWritten, totalBytes }) => reportProgress(bytesWritten, totalBytes),
            })
          : File.createDownloadTask(url, destination, {
              sessionType: 'background',
              onProgress: ({ bytesWritten, totalBytes }) => reportProgress(bytesWritten, totalBytes),
            });
        activeTask = task;
        const apk = task.state === 'paused' ? await task.resumeAsync() : await task.downloadAsync();
        if (pauseChain) await pauseChain;
        if (!apk) {
          if (task.state !== 'paused') throw new Error('The Android update download stopped unexpectedly.');
          resumeState = task.savable();
          await persist(resumeState);
          await waitForForeground();
          attempt -= 1;
          continue;
        }
        await persist();
        await persistChain;
        await AsyncStorage.removeItem(APK_DOWNLOAD_KEY);
        const contentUri = apk.contentUri;
        onReady?.();
        await startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data: contentUri,
          type: 'application/vnd.android.package-archive',
          flags: 1,
          extra: { 'android.intent.extra.RETURN_RESULT': true },
        });
        return;
      } catch (error) {
        lastError = error;
        if (pauseChain) await pauseChain;
        if (task?.state === 'paused') {
          resumeState = task.savable();
          await persist(resumeState);
          await waitForForeground();
          attempt -= 1;
          continue;
        }
        resumeState = undefined;
        if (destination.exists) destination.delete();
        await AsyncStorage.removeItem(APK_DOWNLOAD_KEY);
        if (attempt < APK_DOWNLOAD_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
      } finally {
        task?.release();
        if (activeTask === task) activeTask = null;
      }
    }
  } finally {
    appStateSubscription.remove();
  }
  throw lastError instanceof Error ? lastError : new Error('The Android update could not be downloaded. Please try again.');
}

async function readApkDownloadRecord(url: string, version: string, destinationUri: string): Promise<ApkDownloadRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(APK_DOWNLOAD_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<ApkDownloadRecord>;
    if (record.url !== url || record.version !== version || record.destinationUri !== destinationUri) return null;
    if (record.pausedState?.url !== url || record.pausedState.fileUri !== destinationUri || !record.pausedState.resumeData) return null;
    return {
      url,
      version,
      destinationUri,
      bytesWritten: typeof record.bytesWritten === 'number' ? record.bytesWritten : 0,
      totalBytes: typeof record.totalBytes === 'number' ? record.totalBytes : -1,
      pausedState: record.pausedState,
    };
  } catch {
    return null;
  }
}

function isAllowedStoreUrl(platform: AppVersionConfig['platform'], value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (platform === 'ios') return url.hostname === 'apps.apple.com' || url.hostname === 'itunes.apple.com';
    return url.hostname === 'play.google.com' || url.hostname === 'market.android.com' || url.pathname.toLowerCase().endsWith('.apk');
  } catch {
    return false;
  }
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number(part) || 0);
  const rightParts = right.split('.').map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export type UpdateCheck = AppVersionConfig & { shouldPrompt: boolean; required: boolean };

export async function deferAppUpdate(version: string): Promise<void> {
  await AsyncStorage.setItem(UPDATE_DEFER_KEY, JSON.stringify({ version, deferredAt: Date.now() }));
}

async function isUpdateDeferred(version: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(UPDATE_DEFER_KEY);
    if (!stored) return false;
    const value = JSON.parse(stored) as { version?: unknown; deferredAt?: unknown };
    const deferredAt = typeof value.deferredAt === 'number' ? value.deferredAt : 0;
    if (value.version !== version || Date.now() - deferredAt >= UPDATE_REMINDER_MS) {
      await AsyncStorage.removeItem(UPDATE_DEFER_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function checkAppVersion(): Promise<UpdateCheck | null> {
  let config: AppVersionConfig | null = null;
  try {
    config = await getRemoteVersionConfig();
    await AsyncStorage.setItem(VERSION_CACHE_KEY, JSON.stringify(config));
  } catch {
    try {
      const cached = await AsyncStorage.getItem(VERSION_CACHE_KEY);
      config = cached ? (JSON.parse(cached) as AppVersionConfig) : null;
    } catch {
      config = null;
    }
  }
  if (!config) return null;
  const newerAvailable = compareVersions(CURRENT_VERSION, config.latestVersion) < 0;
  const required = compareVersions(CURRENT_VERSION, config.minimumVersion) < 0 || (config.mode === 'mandatory' && newerAvailable);
  const deferred = !required && config.mode === 'optional' && newerAvailable
    ? await isUpdateDeferred(config.latestVersion)
    : false;
  return { ...config, required, shouldPrompt: required || (config.mode === 'optional' && newerAvailable && !deferred) };
}
