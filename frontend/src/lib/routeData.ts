// "Render as you fetch" for the heavier pages: a route's beforeEnter guard
// runs before the page's code is downloaded, so it starts the page's data
// requests right there, in parallel with that download. When the page
// mounts, it takes the request already in flight instead of starting it
// only then (which used to cost the whole code download in waiting).

interface Pending {
  promise: Promise<unknown>;
  startedAt: number;
}

// A prefetch not taken within this long (the user went elsewhere) is dropped.
const MAX_AGE_MS = 15_000;

const pending = new Map<string, Pending>();

/** The key each prefetching page's data is kept under (shared by its route and the page). */
export const DATA_KEYS = {
  panel: "panel",
  room: (tournamentId: string) => `room:${tournamentId}`,
  tournamentAdmin: (tournamentId: string) => `tournament-admin:${tournamentId}`,
};

/** Starts loading data for the page about to open, under `key`. */
export function prefetchData(key: string, load: () => Promise<unknown>): void {
  const current = pending.get(key);
  if (current && Date.now() - current.startedAt < MAX_AGE_MS) return;
  const promise = load();
  // Handled here so a failure isn't reported as unhandled before the page
  // takes it; the page still gets the rejection from takeData.
  promise.catch(() => undefined);
  pending.set(key, { promise, startedAt: Date.now() });
}

/** The page's data: the request its route prefetched, if fresh (used once), else a new one. */
export function takeData<T>(key: string, load: () => Promise<T>): Promise<T> {
  const current = pending.get(key);
  pending.delete(key);
  if (current && Date.now() - current.startedAt < MAX_AGE_MS) return current.promise as Promise<T>;
  return load();
}
