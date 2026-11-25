/**
 * Recovery for "stale code" errors after a deploy.
 *
 * Each deploy replaces the JS/CSS chunks on the server. A tab opened before the
 * deploy still references the old chunk names, so the next lazily loaded chunk
 * (a tab's page code, a dialog, a detail panel) fails to load. The error
 * boundary's "Try again" re-renders with the same missing chunk and fails
 * again; only a full reload, which fetches the new build, recovers.
 *
 * `deploymentId` (set per Cloudflare build in tools/cloudflare/build.mjs) makes
 * Next.js hard-reload on page navigations across versions. This helper is the
 * backstop for chunk loads that are not navigations.
 */

const RELOAD_KEY = 'syllabus-sync:chunk-reload-at';
/** Do not reload again within this window, so a genuinely broken chunk cannot loop. */
const RELOAD_COOLDOWN_MS = 30_000;

const CHUNK_ERROR_MESSAGE =
  /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return (
    name === 'ChunkLoadError' || (typeof message === 'string' && CHUNK_ERROR_MESSAGE.test(message))
  );
}

/**
 * Reloads the page once if `error` is a stale-chunk error.
 * Returns true when a reload was started.
 */
export function reloadOnceForChunkError(error: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return false;

  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without storage we cannot guard against a reload loop, so show the error UI.
    return false;
  }

  window.location.reload();
  return true;
}
