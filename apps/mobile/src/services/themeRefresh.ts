import type { ThemeDocument } from '../lib/themeValidation';

export type RemoteTheme = { etag: string; theme: ThemeDocument };

export function createThemeRefresher(
  request: (etag: string) => Promise<RemoteTheme | null>,
  persist: (theme: RemoteTheme) => Promise<void>,
  validate: (value: unknown) => value is ThemeDocument,
) {
  let inFlight: Promise<RemoteTheme | null> | null = null;
  return async (etag: string, apply: (theme: ThemeDocument, etag: string) => void): Promise<void> => {
    if (!inFlight) {
      const pending = request(etag).then((remote) => {
        if (remote && validate(remote.theme) && remote.etag) void Promise.resolve().then(() => persist(remote)).catch(() => undefined);
        return remote;
      }).catch(() => null);
      inFlight = pending.finally(() => { inFlight = null; });
    }
    const remote = await inFlight;
    if (!remote || !validate(remote.theme)) return;
    apply(remote.theme, remote.etag);
  };
}
