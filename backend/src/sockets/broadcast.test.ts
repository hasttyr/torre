import type { Server } from "socket.io";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emitToTournament, resetSocketServer, setSocketServer } from "./broadcast";

function fakeServer() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { server: { to } as unknown as Server, to, emit };
}

describe("broadcast", () => {
  afterEach(() => {
    resetSocketServer();
  });

  it("emits an event to the tournament's room once the server is registered", () => {
    const { server, to, emit } = fakeServer();
    setSocketServer(server);

    emitToTournament("tournament-1", "pairing.published", { round: 1 });

    expect(to).toHaveBeenCalledWith("tournament:tournament-1");
    expect(emit).toHaveBeenCalledWith("pairing.published", { round: 1 });
  });

  it("is a no-op when no server has been registered yet", () => {
    // No setSocketServer() call: simulates a service invoked from a unit
    // test, or before server.ts finishes booting.
    expect(() => emitToTournament("tournament-1", "pairing.published", {})).not.toThrow();
  });

  it("stops emitting after resetSocketServer()", () => {
    const { server, to } = fakeServer();
    setSocketServer(server);
    resetSocketServer();

    emitToTournament("tournament-1", "pairing.published", {});

    expect(to).not.toHaveBeenCalled();
  });
});
