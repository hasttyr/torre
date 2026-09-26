import { vi } from "vitest";

/**
 * Replaces the global IntersectionObserver with a controllable one.
 *
 * @remarks
 * jsdom has no IntersectionObserver. `reveal()` reports the observed element
 * as visible, the way a browser does when it scrolls into view. Pair it with
 * `vi.unstubAllGlobals()` in an `afterEach`.
 */
export function stubIntersectionObserver() {
  const observer = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    options: undefined as IntersectionObserverInit | undefined,
  };
  let callback: IntersectionObserverCallback = () => undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (this: unknown, cb: IntersectionObserverCallback, options: IntersectionObserverInit) {
      callback = cb;
      observer.options = options;
      return observer;
    }),
  );
  const reveal = () =>
    callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
  return { observer, reveal };
}
