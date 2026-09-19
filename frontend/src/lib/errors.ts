import axios from "axios";

/**
 * Extracts a user-facing error message from a failed API call.
 *
 * @param error - The error caught from an API call (typically an AxiosError).
 * @param fallback - Message to show when the error carries no usable `error` field
 * (network failure, unexpected response shape, etc.).
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
    return error.response.data.error;
  }
  return fallback;
}
