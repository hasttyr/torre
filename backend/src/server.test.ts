import type { AddressInfo } from "node:net";

import { io as connectClient } from "socket.io-client";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { prisma } from "./config/prisma";
import { startServer } from "./server";

describe("startServer / stop", () => {
  it("serves the API and real-time channel, then stops accepting and lets go of the database", async () => {
    const disconnect = vi.spyOn(prisma, "$disconnect").mockResolvedValue();
    const server = await startServer(0);
    const url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
    await request(url).get("/api/health").expect(200);
    const client = connectClient(url, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client.on("connect", resolve));
    const dropped = new Promise<void>((resolve) => client.on("disconnect", () => resolve()));

    await server.stop();

    await dropped;
    expect(server.httpServer.listening).toBe(false);
    expect(disconnect).toHaveBeenCalled();
    client.close();
  });
});
