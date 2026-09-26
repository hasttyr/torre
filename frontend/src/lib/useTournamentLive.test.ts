import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { useTournamentLive } from "./useTournamentLive";

const { socketMock, handlers } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    handlers,
    socketMock: {
      connected: false,
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler)),
      off: vi.fn((event: string) => handlers.delete(event)),
      connect: vi.fn(),
    },
  };
});

vi.mock("../services/socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/socket")>()),
  getSocket: vi.fn(() => Promise.resolve(socketMock)),
  joinTournamentRoom: vi.fn(),
  leaveTournamentRoom: vi.fn(),
}));

import { joinTournamentRoom, leaveTournamentRoom } from "../services/socket";

/** Mounts a component using the live connection, once the (lazily loaded) socket is ready. */
async function mountLive(onChange: () => void) {
  let connected!: ReturnType<typeof useTournamentLive>["connected"];
  const wrapper = mount(
    defineComponent({
      setup() {
        connected = useTournamentLive("t-1", onChange).connected;
        return () => h("div");
      },
    }),
  );
  await flushPromises();
  return { wrapper, connected: () => connected.value };
}

describe("useTournamentLive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    handlers.clear();
    socketMock.connected = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects when needed and joins the room on every (re)connection", async () => {
    const { connected } = await mountLive(vi.fn());
    expect(socketMock.connect).toHaveBeenCalledTimes(1);
    expect(connected()).toBe(false);

    handlers.get("connect")!();
    expect(connected()).toBe(true);
    expect(joinTournamentRoom).toHaveBeenCalledWith(socketMock, "t-1");

    handlers.get("disconnect")!();
    expect(connected()).toBe(false);
    handlers.get("connect")!();
    expect(joinTournamentRoom).toHaveBeenCalledTimes(2);
  });

  it("joins right away when the socket is already connected", async () => {
    socketMock.connected = true;

    await mountLive(vi.fn());

    expect(socketMock.connect).not.toHaveBeenCalled();
    expect(joinTournamentRoom).toHaveBeenCalledWith(socketMock, "t-1");
  });

  it("coalesces a burst of events (result + standings) into one refresh", async () => {
    const onChange = vi.fn();
    await mountLive(onChange);

    handlers.get("match.result.recorded")!();
    handlers.get("standings.updated")!();
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("leaves the room and stops listening on unmount, dropping a pending refresh", async () => {
    const onChange = vi.fn();
    const { wrapper } = await mountLive(onChange);
    handlers.get("pairing.published")!();

    wrapper.unmount();
    vi.advanceTimersByTime(200);

    expect(leaveTournamentRoom).toHaveBeenCalledWith(socketMock, "t-1");
    expect(handlers.size).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never subscribes if the view is gone before the socket finishes loading", async () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          useTournamentLive("t-1", vi.fn());
          return () => h("div");
        },
      }),
    );
    wrapper.unmount();
    await flushPromises();

    expect(socketMock.on).not.toHaveBeenCalled();
    expect(socketMock.connect).not.toHaveBeenCalled();
  });
});
