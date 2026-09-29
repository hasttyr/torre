import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({ emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn() })),
}));
vi.mock("./auth", () => ({ requestSocketTicket: vi.fn() }));

import { io } from "socket.io-client";

import { setSignedIn } from "./session";
import { requestSocketTicket } from "./auth";
import { getSocket, introduceConnection, joinTournamentRoom, leaveTournamentRoom } from "./socket";

/** What a connection sends as it opens. */
const handshake = () => new Promise<unknown>((resolve) => introduceConnection(resolve));

describe("socket", () => {
  afterEach(() => {
    setSignedIn(false);
  });

  it("creates one client, on first use, without connecting it yet", async () => {
    const [first, second] = await Promise.all([getSocket(), getSocket()]);

    expect(first).toBe(second);
    expect(io).toHaveBeenCalledOnce();
    // Each connection it opens introduces itself (introduceConnection, below).
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ autoConnect: false, auth: introduceConnection }),
    );
  });

  it("introduces itself with a fresh ticket on each connection while signed in, so it may follow the drafts it manages", async () => {
    expect(await handshake()).toEqual({});
    expect(requestSocketTicket).not.toHaveBeenCalled();

    setSignedIn(true);
    vi.mocked(requestSocketTicket).mockResolvedValueOnce("ticket-1");
    expect(await handshake()).toEqual({ ticket: "ticket-1" });
  });

  it("connects anonymously when no ticket can be had (published tournaments need none)", async () => {
    setSignedIn(true);
    vi.mocked(requestSocketTicket).mockRejectedValueOnce(new Error("network"));

    expect(await handshake()).toEqual({});
  });

  it("joins and leaves a tournament's room by its id", async () => {
    const socket = await getSocket();

    joinTournamentRoom(socket, "tournament-1");
    leaveTournamentRoom(socket, "tournament-1");

    expect(socket.emit).toHaveBeenCalledWith("tournament:join", "tournament-1");
    expect(socket.emit).toHaveBeenCalledWith("tournament:leave", "tournament-1");
  });
});
