// Full page loads, in their own module so tests can stand in for them
// (jsdom can't navigate).

/** Reloads the current page. */
export function reloadPage(): void {
  window.location.reload();
}

/** Loads `path` as a fresh page (new index.html and code), not as an in-app navigation. */
export function loadPage(path: string): void {
  window.location.assign(path);
}
