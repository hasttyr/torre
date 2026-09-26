import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, onUnauthorized, setAuthToken } from "./api";

/** Makes every request fail with the given HTTP status, without any network. */
function respondWith(status: number): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError("fail", "ERR", config, null, { status, statusText: "", headers: {}, config, data: {} }),
    );
}

describe("api session handling", () => {
  const handler = vi.fn();
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    handler.mockClear();
    onUnauthorized(handler);
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    setAuthToken(null);
    onUnauthorized(null);
  });

  it("reports a 401 on a request that carried a token (the session is no longer valid)", async () => {
    setAuthToken("stale-token");
    api.defaults.adapter = respondWith(401);

    await expect(api.get("/users/me")).rejects.toBeInstanceOf(AxiosError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores a 401 without a token: a wrong password is an answer, not an expired session", async () => {
    api.defaults.adapter = respondWith(401);

    await expect(api.post("/auth/login", {})).rejects.toBeInstanceOf(AxiosError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores other errors, like a 403 on an action the role can't take", async () => {
    setAuthToken("valid-token");
    api.defaults.adapter = respondWith(403);

    await expect(api.get("/users")).rejects.toBeInstanceOf(AxiosError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("sets and clears the bearer token for every request", () => {
    setAuthToken("abc");
    expect(api.defaults.headers.common.Authorization).toBe("Bearer abc");

    setAuthToken(null);
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });
});
