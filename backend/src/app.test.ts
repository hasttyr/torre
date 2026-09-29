import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { logger } from "./config/logger";

describe("request bodies the API can't read", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers malformed JSON with a 400, not as a server failure", async () => {
    const log = vi.spyOn(logger, "error");

    const response = await request(createApp())
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "ana@example.com",');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "El cuerpo de la petición no es un JSON válido", code: "INVALID_JSON" });
    expect(log).not.toHaveBeenCalled();
  });

  it("answers a body over the size limit with a 413", async () => {
    const log = vi.spyOn(logger, "error");

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "x".repeat(200_000) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "El cuerpo de la petición es demasiado grande", code: "PAYLOAD_TOO_LARGE" });
    expect(log).not.toHaveBeenCalled();
  });

  it("answers an unknown route with a 404 in the same shape as every other error", async () => {
    const response = await request(createApp()).get("/api/nothing-here");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Recurso no encontrado", code: "NOT_FOUND" });
  });
});

// Answers carry personal data and depend on who asks: nothing in between (the
// Vercel proxy's CDN) nor the browser of a shared lab computer may keep them.
describe("caching of API answers", () => {
  it("tells every cache not to keep them, answers and errors alike", async () => {
    const app = createApp();

    for (const path of ["/api/health", "/api/nothing-here"]) {
      const response = await request(app).get(path);
      expect(response.headers["cache-control"], path).toBe("no-store");
    }
  });
});
