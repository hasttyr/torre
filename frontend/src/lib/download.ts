// Revoking the object URL right after click() makes some browsers
// (historically Safari and Firefox) cancel the download; a short wait lets it start.
const REVOKE_AFTER_MS = 1000;

/** Hands a downloaded file (e.g. an exported PDF) to the browser to save. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
