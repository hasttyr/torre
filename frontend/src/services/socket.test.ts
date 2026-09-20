import { describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({ emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn() })),
}));

import { joinTournamentRoom, leaveTournamentRoom, socket } from "./socket";

describe("socket", () => {
  it("emits tournament:join with the tournament id", () => {
    joinTournamentRoom("tournament-1");
    expect(socket.emit).toHaveBeenCalledWith("tournament:join", "tournament-1");
  });

  it("emits tournament:leave with the tournament id", () => {
    leaveTournamentRoom("tournament-1");
    expect(socket.emit).toHaveBeenCalledWith("tournament:leave", "tournament-1");
  });
});
