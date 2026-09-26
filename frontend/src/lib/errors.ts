/** What axios rejects with when the server answered with an error status. */
interface HttpError {
  isAxiosError: true;
  response?: { data?: { error?: unknown } };
}

// Checked by shape rather than with axios.isAxiosError (which does the same
// check): pages like login use this helper, and importing axios here would
// put the whole HTTP client in the initial bundle.
function isHttpError(error: unknown): error is HttpError {
  return typeof error === "object" && error !== null && (error as { isAxiosError?: unknown }).isAxiosError === true;
}

/**
 * Extracts a user-facing error message from a failed API call.
 *
 * @param error - The error caught from an API call (typically an AxiosError).
 * @param fallback - Message to show when the error carries no usable `error` field
 * (network failure, unexpected response shape, etc.).
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  const message = isHttpError(error) ? error.response?.data?.error : undefined;
  return typeof message === "string" ? message : fallback;
}
