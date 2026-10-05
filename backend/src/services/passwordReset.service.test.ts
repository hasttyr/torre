import { createHash } from "node:crypto";

import type { PrismaClient } from "../generated/prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../config/logger";
import type { HttpError } from "../errors/apiErrors";
import { confirmPasswordReset, requestPasswordReset } from "./passwordReset.service";
import type { ResetLinkSender } from "./resetLinkSender";

function buildPrismaMock() {
  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      // The claim on the token: by default, nobody got there first.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    // An interactive transaction runs its callback against the same client.
    $transaction: vi.fn((work: unknown) =>
      typeof work === "function" ? work(prisma) : Promise.all(work as unknown[]),
    ),
  };
  return prisma;
}

describe("requestPasswordReset", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let sender: { send: ReturnType<typeof vi.fn<ResetLinkSender["send"]>> };

  beforeEach(() => {
    prisma = buildPrismaMock();
    sender = { send: vi.fn<ResetLinkSender["send"]>().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const request = (email: string) => requestPasswordReset(prisma as unknown as PrismaClient, email, sender);

  it("stores only the token's hash and sends its owner a link with the token itself", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "ana@example.com", status: "ACTIVE" });

    await request("ana@example.com");

    expect(prisma.passwordResetRequest.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.passwordResetRequest.create.mock.calls[0][0];
    expect(data.userId).toBe("user-1");
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(sender.send).toHaveBeenCalledTimes(1);
    const [email, link] = sender.send.mock.calls[0]!;
    expect(email).toBe("ana@example.com");
    const token = new URL(link).searchParams.get("token")!;
    expect(link).toBe(`http://localhost:5173/restablecer-password?token=${token}`);
    expect(createHash("sha256").update(token).digest("hex")).toBe(data.tokenHash);
  });

  it("never writes the token to the server logs", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "ana@example.com", status: "ACTIVE" });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await request("ana@example.com");

    expect(log).not.toHaveBeenCalled();
  });

  it("answers the same when the mail provider fails, logging the failure without the token", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "ana@example.com", status: "ACTIVE" });
    sender.send.mockRejectedValue(new Error("SMTP 421 service not available"));
    const log = vi.spyOn(logger, "error");

    await expect(request("ana@example.com")).resolves.toBeUndefined();
    await vi.waitFor(() => expect(log).toHaveBeenCalled());

    const token = new URL(sender.send.mock.calls[0]![1]).searchParams.get("token")!;
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
  });

  it("does nothing for an email that doesn't exist (no reveal of account existence)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await request("no-existe@example.com");

    expect(prisma.passwordResetRequest.create).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("does nothing for an inactive account", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "ana@example.com", status: "INACTIVE" });

    await request("ana@example.com");

    expect(prisma.passwordResetRequest.create).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("normalizes the email before looking it up", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await request("  Ana@Example.COM  ");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } });
  });
});

describe("confirmPasswordReset", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  const validRequest = () => ({
    id: "request-1",
    userId: "user-1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  });

  it("updates the password and marks the request as used with a valid token", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue(validRequest());

    await confirmPasswordReset(prisma as unknown as PrismaClient, "un-token-valido", "nuevaPassword123");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    expect(prisma.passwordResetRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-1", usedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { usedAt: expect.any(Date) },
    });
  });

  // Two confirmations with the same link at once: both read it unused, but
  // only the first claim on the row may go on to change the password.
  it("changes nothing when another confirmation used the token first", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue(validRequest());
    prisma.passwordResetRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "un-token-valido", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("stops every other link sent to the account from working", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue(validRequest());

    await confirmPasswordReset(prisma as unknown as PrismaClient, "un-token-valido", "nuevaPassword123");

    expect(prisma.passwordResetRequest.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "request-1" }, usedAt: null },
      data: { expiresAt: expect.any(Date) },
    });
  });

  it("rejects a token that doesn't exist", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue(null);

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "no-existe", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "expirado", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it("rejects an already-used token", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "usado", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });
});
