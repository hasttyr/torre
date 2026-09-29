import { Writable } from "node:stream";

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createLogger } from "../config/logger";
import { requestLogger } from "./requestLogger";

/** An app logging to memory: one request logger, and a route that authenticates like requireAuth does. */
function appWithLog() {
  const lines: Record<string, unknown>[] = [];
  const memory = new Writable({
    write(chunk, _encoding, done) {
      lines.push(JSON.parse(String(chunk)));
      done();
    },
  });
  const app = express();
  app.use(express.json());
  app.use(requestLogger(createLogger({ level: "info", destination: memory })));
  app.post("/api/things", (req, res) => {
    req.user = { id: "user-7", role: "COACH" };
    res.status(201).json({ ok: true });
  });
  app.post("/api/sign-in", (_req, res) => {
    res.cookie("torre_session", "cookie.jwt.value", { httpOnly: true }).status(200).json({ ok: true });
  });
  return { app, lines };
}

describe("requestLogger", () => {
  it("logs each request with an id, its outcome and who made it", async () => {
    const { app, lines } = appWithLog();

    const response = await request(app).post("/api/things").send({});

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      req: { method: "POST", url: "/api/things", id: response.headers["x-request-id"] },
      res: { statusCode: 201 },
      userId: "user-7",
    });
  });

  it("keeps the request id a proxy or client already assigned, to follow one request across services", async () => {
    const { app, lines } = appWithLog();

    const response = await request(app).post("/api/things").set("X-Request-Id", "edge-42").send({});

    expect(response.headers["x-request-id"]).toBe("edge-42");
    expect(lines[0]).toMatchObject({ req: { id: "edge-42" } });
  });

  it("never writes a session token to the logs", async () => {
    const { app, lines } = appWithLog();

    await request(app)
      .post("/api/things")
      .set("Authorization", "Bearer secret.jwt.value")
      .send({ password: "hunter22" });

    const logged = JSON.stringify(lines);
    expect(logged).not.toContain("secret.jwt.value");
    expect(logged).not.toContain("hunter22");
  });

  it("never writes the session cookie to the logs, going in or coming out", async () => {
    const { app, lines } = appWithLog();

    await request(app).post("/api/sign-in").set("Cookie", "torre_session=sent.jwt.value").send({});

    const logged = JSON.stringify(lines);
    expect(logged).not.toContain("sent.jwt.value");
    expect(logged).not.toContain("cookie.jwt.value");
  });

  it("logs the client's address as the app resolves it (behind TRUST_PROXY, the forwarded one)", async () => {
    const { app, lines } = appWithLog();
    app.set("trust proxy", 1);

    await request(app).post("/api/things").set("X-Forwarded-For", "203.0.113.9").send({});

    expect(lines[0]).toMatchObject({ ip: "203.0.113.9" });
  });
});

describe("createLogger", () => {
  it("masks credentials in anything logged, not only requests", () => {
    const lines: string[] = [];
    const memory = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });

    createLogger({ level: "info", destination: memory }).info({ body: { password: "hunter22", token: "abc123" } }, "x");

    expect(lines.join("")).not.toMatch(/hunter22|abc123/);
  });
});
