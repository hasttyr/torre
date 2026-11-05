import { createServer, type Server } from "node:http";

import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { tournament: { findMany: vi.fn().mockResolvedValue([]) } },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

const servers: Server[] = [];

/** A fresh app (and so fresh rate-limit counts) on one port: these tests send hundreds of requests. */
function serve(): Server {
  const server = createServer(createApp()).listen(0);
  servers.push(server);
  return server;
}

afterAll(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((closed) => server.close(closed));
  }
});

// HU25 / RF17: the one page anyone can read without signing in, so the one
// a scraper would hammer: it has a rate limit of its own.
describe("GET /tournaments/public", () => {
  it("answers without a session, asking the database only for the tournament's own fields", async () => {
    await request(serve()).get("/api/tournaments/public").expect(200);

    const query = prismaMock.tournament.findMany.mock.calls[0]![0];
    expect(query.where).toEqual({ status: "REGISTRATION_OPEN" });
    expect(query.select).not.toHaveProperty("organizerId");
    expect(query.include).toBeUndefined();
  });

  it("refuses an address that keeps asking, with the usual 429", async () => {
    const server = serve();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 300; attempt++) {
      statuses.push((await request(server).get("/api/tournaments/public")).status);
    }

    const refused = await request(server).get("/api/tournaments/public");

    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(refused.status).toBe(429);
    expect(refused.body.code).toBe("RATE_LIMITED");
  });
});
