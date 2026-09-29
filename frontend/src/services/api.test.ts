import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, path } from "./api";
import { getTournament } from "./tournaments";
import { onUnauthorized, setSignedIn } from "./session";

/** Makes every request fail with the given HTTP status, without any network. */
function respondWith(status: number): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError("fail", "ERR", config, null, { status, statusText: "", headers: {}, config, data: {} }),
    );
}

/** Answers 200 and remembers the request it got. */
function recordRequests(sent: InternalAxiosRequestConfig[]): AxiosAdapter {
  return async (config) => {
    sent.push(config);
    return { status: 200, statusText: "OK", headers: {}, config, data: {} };
  };
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
    setSignedIn(false);
    onUnauthorized(null);
  });

  it("talks to the API on the app's own site (/api), where the session cookie is first-party", () => {
    expect(api.defaults.baseURL).toBe("/api");
  });

  it("stays on /api even if a build still sets the API's own address (where the cookie wouldn't be sent)", async () => {
    vi.stubEnv("VITE_API_URL", "https://torre-be.onrender.com/api");
    vi.resetModules();
    try {
      const fresh = await import("./api");
      expect(fresh.api.defaults.baseURL).toBe("/api");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reports a 401 while signed in (the session is no longer valid)", async () => {
    setSignedIn(true);
    api.defaults.adapter = respondWith(401);

    await expect(api.get("/users/me")).rejects.toBeInstanceOf(AxiosError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores a 401 while signed out: a wrong password is an answer, not an expired session", async () => {
    api.defaults.adapter = respondWith(401);

    await expect(api.post("/auth/login", {})).rejects.toBeInstanceOf(AxiosError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores other errors, like a 403 on an action the role can't take", async () => {
    setSignedIn(true);
    api.defaults.adapter = respondWith(403);

    await expect(api.get("/users")).rejects.toBeInstanceOf(AxiosError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("sends no token: the session travels in its HttpOnly cookie, out of script's reach", async () => {
    const sent: InternalAxiosRequestConfig[] = [];
    api.defaults.adapter = recordRequests(sent);
    setSignedIn(true);

    await api.get("/users/me");

    expect(sent[0].headers.Authorization).toBeUndefined();
  });
});

describe("path", () => {
  it("encodes every value put into an API path, so an id can't change which endpoint is called", () => {
    expect(path`/tournaments/${"../users?role=ADMIN"}/rounds`).toBe("/tournaments/..%2Fusers%3Frole%3DADMIN/rounds");
  });

  it("leaves ordinary ids as they are", () => {
    expect(path`/rounds/${"3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b"}/swap`).toBe(
      "/rounds/3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b/swap",
    );
  });

  it("is what the services build their requests with", async () => {
    const sent: InternalAxiosRequestConfig[] = [];
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = recordRequests(sent);

    await getTournament("../users?x=1");

    api.defaults.adapter = originalAdapter;
    expect(sent[0]?.url).toBe("/tournaments/..%2Fusers%3Fx%3D1");
  });
});
