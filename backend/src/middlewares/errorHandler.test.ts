import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { logger } from "../config/logger";
import { HttpError } from "../errors/apiErrors";
import { errorHandler } from "./errorHandler";

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
  it("answers an expected error with its status, its stable code and a readable message", async () => {
    const response = await request(appFailingWith(new HttpError("TOURNAMENT_NOT_FOUND"))).get("/fails");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Torneo no encontrado", code: "TOURNAMENT_NOT_FOUND" });
  });

  it("sends the values the message was filled with, so a client can word it in its own language", async () => {
    const response = await request(appFailingWith(new HttpError("RESULTS_PENDING", { number: 3 }))).get("/fails");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "Faltan resultados de la ronda 3",
      code: "RESULTS_PENDING",
      params: { number: 3 },
    });
  });

  it("keeps the status of any other request error Express marks as the client's, with a generic message", async () => {
    const unsupported = Object.assign(new Error('unsupported charset "KOI8-R"'), {
      status: 415,
      expose: true,
      type: "charset.unsupported",
    });

    const response = await request(appFailingWith(unsupported)).get("/fails");

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: "La petición no es válida", code: "BAD_REQUEST" });
  });

  it("answers anything unexpected with a generic 500, logging the details server-side only", async () => {
    const log = vi.spyOn(logger, "error");

    const response = await request(appFailingWith(new Error("connection refused: 10.0.0.5"))).get("/fails");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
