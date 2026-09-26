import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installStaleChunkReload } from "./staleChunks";

const chunkFailed = () => window.dispatchEvent(new Event("vite:preloadError"));

describe("installStaleChunkReload", () => {
  let uninstall: () => void;
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    vi.useFakeTimers();
    uninstall = installStaleChunkReload(reload);
  });

  afterEach(() => {
    uninstall();
    vi.useRealTimers();
  });

  it("reloads the page when a chunk is gone, to pick up the new deploy's files", () => {
    chunkFailed();

    expect(reload).toHaveBeenCalledOnce();
  });

  it("doesn't reload again right after a reload: a chunk that's broken for real mustn't loop", () => {
    chunkFailed();
    chunkFailed();
    expect(reload).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(10_001);
    chunkFailed();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("lets the error show when storage is blocked, since it couldn't tell a loop apart", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    chunkFailed();

    expect(reload).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
