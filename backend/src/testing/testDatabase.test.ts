import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../generated/prisma/client";
import { resetDatabase } from "./testDatabase";

describe("resetDatabase", () => {
  it("refuses to empty a database whose name doesn't end in _test, whatever URL led there", async () => {
    const truncate = vi.fn();
    const connectedToDev = {
      $queryRaw: vi.fn(async () => [{ name: "torre_central_hub" }]),
      $executeRawUnsafe: truncate,
    } as unknown as PrismaClient;

    await expect(resetDatabase(connectedToDev)).rejects.toThrow(/"torre_central_hub".*_test/);
    expect(truncate).not.toHaveBeenCalled();
  });
});
