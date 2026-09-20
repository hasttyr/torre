import type { Server, Socket } from "socket.io";
import { describe, expect, it, vi } from "vitest";

import { registerSocketHandlers } from "./index";

/** Builds a fake Socket.IO server that immediately "connects" one fake socket, exposing its registered handlers. */
function fakeConnection() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    join: vi.fn(),
    leave: vi.fn(),
  };

  const io = {
    on: (event: string, handler: (socket: unknown) => void) => {
      if (event === "connection") handler(socket);
    },
  } as unknown as Server;

  registerSocketHandlers(io);

  return {
    socket: socket as unknown as Socket,
    trigger: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
  };
}

describe("registerSocketHandlers", () => {
  it("joins the tournament's room on tournament:join", () => {
    const { socket, trigger } = fakeConnection();

    trigger("tournament:join", "tournament-1");

    expect(socket.join).toHaveBeenCalledWith("tournament:tournament-1");
  });

  it("leaves the tournament's room on tournament:leave", () => {
    const { socket, trigger } = fakeConnection();

    trigger("tournament:leave", "tournament-1");

    expect(socket.leave).toHaveBeenCalledWith("tournament:tournament-1");
  });

  it("ignores a non-string or empty tournament id", () => {
    const { socket, trigger } = fakeConnection();

    trigger("tournament:join", "");
    trigger("tournament:join", 42);
    trigger("tournament:join", null);

    expect(socket.join).not.toHaveBeenCalled();
  });
});
