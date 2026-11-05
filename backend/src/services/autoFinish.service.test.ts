import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../generated/prisma/client";
import { AUTO_FINISH_INTERVAL_MS, closesAt, scheduleAutoFinish } from "./autoFinish.service";

describe("closesAt", () => {
  it("is the end of the tournament's last day in Bogotá (UTC-5)", () => {
    expect(closesAt(new Date("2026-10-02")).toISOString()).toBe("2026-10-03T05:00:00.000Z");
  });
});

describe("scheduleAutoFinish", () => {
  const log = { info: vi.fn(), error: vi.fn() };
  let findMany: ReturnType<typeof vi.fn>;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    findMany = vi.fn().mockResolvedValue([]);
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const start = () => {
    stop = scheduleAutoFinish({ tournament: { findMany } } as unknown as PrismaClient, log);
  };

  it("looks at once on startup, then every 15 minutes", async () => {
    start();
    await vi.advanceTimersByTimeAsync(0);
    expect(findMany).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(AUTO_FINISH_INTERVAL_MS);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("stops looking once stopped", async () => {
    start();
    await vi.advanceTimersByTimeAsync(0);
    stop();

    await vi.advanceTimersByTimeAsync(AUTO_FINISH_INTERVAL_MS * 3);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("logs a failed pass and keeps going", async () => {
    findMany.mockRejectedValueOnce(new Error("database down"));
    start();
    await vi.advanceTimersByTimeAsync(0);
    expect(log.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "could not look for tournaments past their end date",
    );

    await vi.advanceTimersByTimeAsync(AUTO_FINISH_INTERVAL_MS);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("logs a tournament it couldn't close, by its id", async () => {
    findMany.mockResolvedValueOnce([{ id: "t-1" }]);
    const transaction = vi.fn().mockRejectedValue(new Error("deadlock"));
    stop = scheduleAutoFinish({ tournament: { findMany }, $transaction: transaction } as unknown as PrismaClient, log);
    await vi.advanceTimersByTimeAsync(0);

    expect(log.error).toHaveBeenCalledWith(
      { err: expect.any(Error), tournamentId: "t-1" },
      "could not close a tournament past its end date",
    );
  });

  it("never starts a pass while the last one is still running", async () => {
    findMany.mockReturnValueOnce(new Promise(() => {}));
    start();
    await vi.advanceTimersByTimeAsync(AUTO_FINISH_INTERVAL_MS * 2);

    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
