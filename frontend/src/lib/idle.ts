/**
 * Runs `task` once the page has loaded and the browser has nothing better
 * to do, for prefetching code the user will likely need soon without
 * competing with what they need now. (requestIdleCallback alone isn't
 * enough: there are idle gaps in the middle of loading the page.)
 */
export function whenIdle(task: () => void): void {
  const schedule = (): void => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => task(), { timeout: 3000 });
    } else {
      setTimeout(task, 1500);
    }
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}
