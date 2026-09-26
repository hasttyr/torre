import { afterEach, describe, expect, it, vi } from "vitest";

import { prefetchData, takeData } from "./routeData";

describe("route data prefetch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands the page the request its route already started, instead of a second one", async () => {
    const load = vi.fn().mockResolvedValue("dashboard");

    prefetchData("panel", load);
    const data = await takeData("panel", load);

    expect(data).toBe("dashboard");
    expect(load).toHaveBeenCalledOnce();
  });

  it("loads normally when nothing was prefetched, and uses a prefetch only once", async () => {
    const load = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("fresh");

    prefetchData("room:t-1", load);
    await takeData("room:t-1", load);
    const second = await takeData("room:t-1", load);

    expect(second).toBe("fresh");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("doesn't start the same prefetch twice while one is in flight", () => {
    const load = vi.fn(() => new Promise(() => {}));

    prefetchData("room:t-2", load);
    prefetchData("room:t-2", load);

    expect(load).toHaveBeenCalledOnce();
  });

  it("drops a prefetch nobody took (the user navigated elsewhere), so it never serves stale data", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");

    prefetchData("panel:stale", load);
    vi.advanceTimersByTime(30_000);

    await expect(takeData("panel:stale", load)).resolves.toBe("new");
  });

  it("lets the page see a failed prefetch, without an unhandled rejection in the meantime", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down"));

    prefetchData("room:t-3", failing);
    await Promise.resolve();

    await expect(takeData("room:t-3", failing)).rejects.toThrow("down");
  });
});
