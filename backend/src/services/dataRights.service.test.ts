import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exerciseDataRight } from "./dataRights.service";

function buildPrismaMock() {
  return {
    user: { findUnique: vi.fn(), update: vi.fn() },
    player: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    dataRequest: { create: vi.fn() },
  };
}

const baseUser = {
  id: "user-1",
  name: "Ana Torres",
  email: "ana@example.com",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01"),
  role: { name: "PLAYER" },
  player: null,
  dataPolicyAccepted: true,
  dataPolicyAcceptedAt: new Date("2026-01-01"),
  dataPolicyVersion: "2026-08-01",
};

describe("exerciseDataRight", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("ACCESS: returns the user's own data and logs the request as resolved", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "user-1", { type: "ACCESS" });

    expect(result.status).toBe("RESOLVED");
    expect(result.user.email).toBe("ana@example.com");
    expect(prisma.dataRequest.create).toHaveBeenCalledWith({
      data: { userId: "user-1", type: "ACCESS", status: "RESOLVED" },
    });
  });

  it("RECTIFICATION: applies the update and logs the request as resolved", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, player: null });
    prisma.user.update.mockResolvedValue({ ...baseUser, name: "Ana T." });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "user-1", {
      type: "RECTIFICATION",
      data: { name: "Ana T." },
    });

    expect(result.status).toBe("RESOLVED");
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ name: "Ana T." });
    expect(prisma.dataRequest.create).toHaveBeenCalledWith({
      data: { userId: "user-1", type: "RECTIFICATION", status: "RESOLVED" },
    });
  });

  it("SUPPRESSION: anonymizes and resolves when there's no active tournament enrollment", async () => {
    prisma.player.findUnique.mockResolvedValue({ id: "player-1", userId: "user-1" });
    prisma.enrollment.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({ ...baseUser, name: "Usuario eliminado", status: "INACTIVE" });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "user-1", { type: "SUPPRESSION" });

    expect(result.status).toBe("RESOLVED");
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ status: "INACTIVE" });
    expect(prisma.dataRequest.create).toHaveBeenCalledWith({
      data: { userId: "user-1", type: "SUPPRESSION", status: "RESOLVED", detail: undefined },
    });
  });

  it("SUPPRESSION: blocks (deactivates without erasing) when the player has an active tournament enrollment", async () => {
    prisma.player.findUnique.mockResolvedValue({ id: "player-1", userId: "user-1" });
    prisma.enrollment.findFirst.mockResolvedValue({ id: "enrollment-1" });
    prisma.user.update.mockResolvedValue({ ...baseUser, status: "INACTIVE" });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "user-1", {
      type: "SUPPRESSION",
      reason: "Ya no quiero participar",
    });

    expect(result.status).toBe("BLOCKED");
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ status: "INACTIVE" });
    expect(prisma.user.update.mock.calls[0][0].data.name).toBeUndefined();
    expect(prisma.dataRequest.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "SUPPRESSION",
        status: "BLOCKED",
        detail: "Ya no quiero participar",
      },
    });
  });

  it("SUPPRESSION: resolves without a block when the user has no player profile at all", async () => {
    prisma.player.findUnique.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({ ...baseUser, status: "INACTIVE" });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "user-1", { type: "SUPPRESSION" });

    expect(result.status).toBe("RESOLVED");
    expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
  });
});
