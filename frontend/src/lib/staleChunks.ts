import { reloadPage } from "./reloadPage";

// Kept in sessionStorage: it has to survive the reload it guards.
const RELOADED_AT_KEY = "torre.chunkReloadAt";
const MIN_INTERVAL_MS = 10_000;

/**
 * Recovers a tab opened before a deploy: its lazily loaded pages and
 * components point at files the deploy replaced (their names carry a
 * content hash), so opening one fails. Vite reports that as
 * `vite:preloadError`; reloading fetches the new index.html and its files.
 * At most one reload every ten seconds, so a file that's broken for real
 * shows its error instead of reloading forever.
 *
 * @returns A function that removes the handler.
 */
export function installStaleChunkReload(reload: () => void = reloadPage): () => void {
  const onPreloadError = (): void => {
    let last: number;
    try {
      last = Number(sessionStorage.getItem(RELOADED_AT_KEY)) || 0;
      sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
    } catch {
      // Storage blocked: without the guard a reload could loop, so let the
      // error show instead.
      return;
    }
    if (Date.now() - last > MIN_INTERVAL_MS) reload();
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}
