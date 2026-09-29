import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

// A fake API for the few tests that go through the real HTTP client
// (services/api.ts) instead of mocking the services: URL building, the
// axios interceptors and the server's real error shape, together.

/** Where services/api.ts sends requests: /api on the page's own origin. */
export const API = `${window.location.origin}/api`;

export const fakeApi = setupServer();

/**
 * Runs the fake API for every test in the file. Each test declares the
 * requests it expects (`fakeApi.use(...)`); any other request fails the test.
 */
export function useFakeApi(): void {
  beforeAll(() => fakeApi.listen({ onUnhandledRequest: "error" }));
  afterEach(() => fakeApi.resetHandlers());
  afterAll(() => fakeApi.close());
}
