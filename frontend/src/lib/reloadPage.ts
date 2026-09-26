/** Reloads the current page. Its own module so tests can stand in for it (jsdom can't reload). */
export function reloadPage(): void {
  window.location.reload();
}
