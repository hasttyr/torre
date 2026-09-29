import { i18n } from "../i18n";

/** The API's error body (backend/src/errors/apiErrors.ts). */
interface ApiErrorBody {
  error?: unknown;
  code?: unknown;
  params?: Record<string, string | number>;
  fields?: Record<string, string>;
}

/** What axios rejects with when the server answered with an error status. */
interface HttpError {
  isAxiosError: true;
  response?: { data?: ApiErrorBody };
}

// Checked by shape rather than with axios.isAxiosError (which does the same
// check): pages like login use this helper, and importing axios here would
// put the whole HTTP client in the initial bundle.
function isHttpError(error: unknown): error is HttpError {
  return typeof error === "object" && error !== null && (error as { isAxiosError?: unknown }).isAxiosError === true;
}

function bodyOf(error: unknown): ApiErrorBody | undefined {
  return isHttpError(error) ? error.response?.data : undefined;
}

/**
 * Extracts a user-facing error message from a failed API call.
 *
 * @remarks
 * A known error is worded in the page's language from its stable `code`
 * (apiErrors.* in the locales, filled with its `params`). Invalid data
 * (VALIDATION_FAILED) keeps the server's message, which says what's wrong
 * with each field, and so does a code this client doesn't know yet.
 *
 * @param error - The error caught from an API call (typically an AxiosError).
 * @param fallback - Message to show when the error carries no usable message
 * (network failure, unexpected response shape, etc.).
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  const body = bodyOf(error);
  const key = `apiErrors.${String(body?.code)}`;
  if (typeof body?.code === "string" && i18n.global.te(key)) {
    return i18n.global.t(key, body.params ?? {});
  }
  return typeof body?.error === "string" ? body.error : fallback;
}

/**
 * The message for each invalid field of a rejected request (VALIDATION_FAILED),
 * keyed by its path ("name", "player.semester"), for a form to show inline.
 */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  return bodyOf(error)?.fields ?? {};
}
