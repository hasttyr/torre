import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

import { Server } from "socket.io";
import { io as connectClient, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { bearer, createUser, resetDatabase, type TestUser } from "../testing/testDatabase";
import { emitToTournament, resetSocketServer, setSocketServer } from "./broadcast";
import { SOCKET_EVENTS } from "./events";
import { registerSocketHandlers } from "./index";

const app = createApp();
let httpServer: HttpServer;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  httpServer = createServer(app);
  const io = new Server(httpServer);
  registerSocketHandlers(io);
  setSocketServer(io);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.disconnect());
});

afterAll(async () => {
  resetSocketServer();
  await new Promise((resolve) => httpServer.close(resolve));
  await prisma.$disconnect();
});

/** A connected client with the handshake `auth` it sends. */
async function connectWith(auth: object): Promise<Socket> {
  const client = connectClient(url, { transports: ["websocket"], auth });
  clients.push(client);
  await new Promise<void>((resolve) => client.on("connect", resolve));
  return client;
}

/** A connected client, signed in as `user` (with a ticket from the API, as the app does) or anonymous. */
async function connect(user?: TestUser): Promise<Socket> {
  if (!user) return connectWith({});
  const { body } = await request(app).post("/api/auth/socket-ticket").set(bearer(user)).expect(200);
  return connectWith({ ticket: body.ticket });
}

/** Asks to join a tournament's room; resolves with whether the server let it in. */
function join(client: Socket, tournamentId: unknown): Promise<boolean> {
  return new Promise((resolve) => client.emit("tournament:join", tournamentId, resolve));
}

/** Resolves with the next `event` the client gets, or with null if none arrives within `ms`. */
function nextEvent(client: Socket, event: string, ms = 300): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    client.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const tournament = (organizer: TestUser, status: "CREATED" | "IN_PROGRESS", name = "Copa") =>
  prisma.tournament.create({
    data: { name, startDate: new Date(), endDate: new Date(), status, organizerId: organizer.id },
  });

describe("tournament rooms", () => {
  it("deliver a published tournament's events to whoever follows it, signed in or not", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const live = await tournament(organizer, "IN_PROGRESS");
    const anonymous = await connect();

    expect(await join(anonymous, live.id)).toBe(true);
    const received = nextEvent(anonymous, SOCKET_EVENTS.STANDINGS_UPDATED);
    emitToTournament(live.id, SOCKET_EVENTS.STANDINGS_UPDATED, { tournamentId: live.id });

    expect(await received).toEqual({ tournamentId: live.id });
  });

  it("stop delivering a tournament's events once the client leaves", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const live = await tournament(organizer, "IN_PROGRESS");
    const client = await connect(organizer);
    await join(client, live.id);

    client.emit("tournament:leave", live.id);
    // Any round trip after the leave: the server handles a connection's events in order.
    await join(client, "not-a-tournament");
    const received = nextEvent(client, SOCKET_EVENTS.STANDINGS_UPDATED);
    emitToTournament(live.id, SOCKET_EVENTS.STANDINGS_UPDATED, { tournamentId: live.id });

    expect(await received).toBeNull();
  });

  it("turn away anything that isn't the id of an existing tournament", async () => {
    const client = await connect();

    expect(await join(client, "tournament:../../x")).toBe(false);
    expect(await join(client, 42)).toBe(false);
    expect(await join(client, "7d0c1a52-1111-4b2e-9c7a-0f5e3a1d2b3c")).toBe(false);
  });

  it("keep a draft tournament's room to whoever runs it, as the REST API does", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const player = await createUser(prisma, "PLAYER");
    const draft = await tournament(organizer, "CREATED");

    expect(await join(await connect(player), draft.id)).toBe(false);
    expect(await join(await connect(organizer), draft.id)).toBe(true);
  });

  it("only count a ticket as signing in: a session token in its place is an anonymous connection", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const draft = await tournament(organizer, "CREATED");

    expect(await join(await connectWith({ ticket: organizer.token }), draft.id)).toBe(false);
    expect(await join(await connect(organizer), draft.id)).toBe(true);
  });

  it("cap how many rooms one connection can be in", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const client = await connect();
    const joined: boolean[] = [];

    for (let index = 0; index < 11; index++) {
      joined.push(await join(client, (await tournament(organizer, "IN_PROGRESS", `Copa ${index}`)).id));
    }

    expect(joined.filter(Boolean)).toHaveLength(10);
    expect(joined.at(-1)).toBe(false);
  });
});

describe("draft rounds", () => {
  it("are announced to the tournament's managers only", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const players = await Promise.all([1, 2, 3, 4].map(() => createUser(prisma, "PLAYER")));
    const live = await tournament(organizer, "IN_PROGRESS");
    const [a, b, c, d] = players.map((player) => player.playerId!);
    const round = await prisma.round.create({
      data: {
        tournamentId: live.id,
        number: 2,
        matches: {
          create: [
            { board: 1, whiteId: a, blackId: b },
            { board: 2, whiteId: c, blackId: d },
          ],
        },
      },
    });
    const managerClient = await connect(organizer);
    const playerClient = await connect(players[0]);
    await join(managerClient, live.id);
    await join(playerClient, live.id);
    const toManager = nextEvent(managerClient, SOCKET_EVENTS.PAIRING_ADJUSTED);
    const toPlayer = nextEvent(playerClient, SOCKET_EVENTS.PAIRING_ADJUSTED);

    await request(app)
      .post(`/api/rounds/${round.id}/swap`)
      .set(bearer(organizer))
      .send({ playerAId: b, playerBId: c, reason: "Hermanos" })
      .expect(200);

    expect(await toManager).toEqual({ roundId: round.id });
    expect(await toPlayer).toBeNull();
  });
});
