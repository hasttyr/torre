import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { errorHandler, HttpError } from "./errorHandler";

/** An app with one async route that fails with `error`, and the API's error handler. */
function appFailingWith(error: unknown) {
  const app = express();
  app.get("/fails", async () => {
    await Promise.resolve();
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("gets what an async route throws, with no wrapper around the route", async () => {
    const response = await request(appFailingWith(new HttpError(409, "El torneo ya está cerrado"))).get("/fails");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "El torneo ya está cerrado" });
  });

  it("answers anything unexpected with a generic 500, logging the details server-side only", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(appFailingWith(new Error("connection refused: 10.0.0.5"))).get("/fails");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Error interno del servidor" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
