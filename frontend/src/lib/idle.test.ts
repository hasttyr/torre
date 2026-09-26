import { afterEach, describe, expect, it, vi } from "vitest";

import { whenIdle } from "./idle";

describe("whenIdle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits for the browser to be idle", () => {
    const requestIdleCallback = vi.fn((callback: () => void) => callback());
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    const task = vi.fn();

    whenIdle(task);

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
    expect(task).toHaveBeenCalledOnce();
  });

  it("waits for the page to finish loading first", () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    const requestIdleCallback = vi.fn((callback: () => void) => callback());
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    const task = vi.fn();

    whenIdle(task);
    expect(task).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));

    expect(task).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it("falls back to a short delay where there's no idle callback (Safari)", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();
    const task = vi.fn();

    whenIdle(task);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);

    expect(task).toHaveBeenCalledOnce();
  });
});
