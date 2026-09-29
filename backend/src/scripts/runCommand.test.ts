import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../generated/prisma/client";
import { runCommand } from "./runCommand";

function fakes() {
  const prisma = { $disconnect: vi.fn().mockResolvedValue(undefined) } as unknown as PrismaClient;
  const output = { log: vi.fn(), error: vi.fn() };
  return { prisma, output };
}

describe("runCommand", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it("prints what the command says, given the command line's arguments, then lets go of the database", async () => {
    const { prisma, output } = fakes();
    const command = vi.fn().mockResolvedValue("3 entries linked.");

    await runCommand(command, { prisma, output, args: ["--apply"] });

    expect(command).toHaveBeenCalledWith(prisma, ["--apply"]);
    expect(output.log).toHaveBeenCalledWith("3 entries linked.");
    expect(process.exitCode).toBeUndefined();
    expect(prisma.$disconnect).toHaveBeenCalled();
  });

  it("says why it failed and exits with an error, still letting go of the database", async () => {
    const { prisma, output } = fakes();

    await runCommand(() => Promise.reject(new Error("EMAIL_TAKEN")), { prisma, output, args: [] });

    expect(output.error).toHaveBeenCalledWith("Failed: EMAIL_TAKEN");
    expect(process.exitCode).toBe(1);
    expect(prisma.$disconnect).toHaveBeenCalled();
  });
});
