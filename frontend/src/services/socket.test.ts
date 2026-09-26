import { describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({ emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn() })),
}));

import { io } from "socket.io-client";

import { getSocket, joinTournamentRoom, leaveTournamentRoom } from "./socket";

describe("socket", () => {
  it("creates one client, on first use, without connecting it yet", async () => {
    const [first, second] = await Promise.all([getSocket(), getSocket()]);

    expect(first).toBe(second);
    expect(io).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledWith(expect.any(String), { autoConnect: false });
  });

  it("joins and leaves a tournament's room by its id", async () => {
    const socket = await getSocket();

    joinTournamentRoom(socket, "tournament-1");
    leaveTournamentRoom(socket, "tournament-1");

    expect(socket.emit).toHaveBeenCalledWith("tournament:join", "tournament-1");
    expect(socket.emit).toHaveBeenCalledWith("tournament:leave", "tournament-1");
  });
});
