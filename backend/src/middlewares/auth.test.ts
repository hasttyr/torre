import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuth, requireRole } from "./auth";
import { HttpError } from "./errorHandler";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findFirst: vi.fn() } },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function buildReq(headers: Record<string, string> = {}): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
    user: undefined,
  } as unknown as Request;
}

function signValidToken(overrides: Partial<{ sub: string; role: string }> = {}): string {
  return jwt.sign({ sub: "user-1", role: "ORGANIZER", ...overrides }, "test-secret", { expiresIn: "1h" });
}

/** Runs requireAuth and resolves with whatever it passed to next(). */
function runRequireAuth(req: Request): Promise<unknown> {
  return new Promise((resolve) => {
    requireAuth(req, {} as Response, ((error?: unknown) => resolve(error)) as NextFunction);
  });
}

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findFirst.mockResolvedValue({ id: "user-1" });
  });

  it("attaches req.user and calls next when the token is valid and still current", async () => {
    const req = buildReq({ authorization: `Bearer ${signValidToken()}` });

    const error = await runRequireAuth(req);

    expect(error).toBeUndefined();
    expect(req.user).toEqual({ id: "user-1", role: "ORGANIZER" });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: "user-1", status: "ACTIVE", role: { name: "ORGANIZER" } },
      select: { id: true },
    });
  });

  it("rejects with 401 when the Authorization header is missing, without touching the database", async () => {
    const error = await runRequireAuth(buildReq());

    expect(error).toMatchObject({ status: 401 } satisfies Partial<HttpError>);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the token is signed with a different secret", async () => {
    const token = jwt.sign({ sub: "user-1", role: "ORGANIZER" }, "otro-secreto", { expiresIn: "1h" });

    expect(await runRequireAuth(buildReq({ authorization: `Bearer ${token}` }))).toMatchObject({ status: 401 });
  });

  it("rejects with 401 when the token has expired", async () => {
    const expired = jwt.sign({ sub: "user-1", role: "ORGANIZER" }, "test-secret", { expiresIn: -1 });

    expect(await runRequireAuth(buildReq({ authorization: `Bearer ${expired}` }))).toMatchObject({ status: 401 });
  });

  it("rejects a still-unexpired token once the account was blocked or its role changed", async () => {
    // findFirst filters by status ACTIVE and the token's role: no row means
    // one of them no longer holds.
    prismaMock.user.findFirst.mockResolvedValue(null);
    const req = buildReq({ authorization: `Bearer ${signValidToken()}` });

    const error = await runRequireAuth(req);

    expect(error).toMatchObject({ status: 401 } satisfies Partial<HttpError>);
    expect(req.user).toBeUndefined();
  });

  it("forwards a database failure to the error handler instead of hanging", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("db down"));

    const error = await runRequireAuth(buildReq({ authorization: `Bearer ${signValidToken()}` }));

    expect(error).toBeInstanceOf(Error);
  });
});

describe("requireRole", () => {
  it("lets the request through when req.user's role is allowed", () => {
    const req = { user: { id: "user-1", role: "ADMINISTRATOR" } } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRATOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with 403 when the role is not allowed", () => {
    const req = { user: { id: "user-1", role: "PLAYER" } } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRATOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 } satisfies Partial<HttpError>));
  });

  it("rejects with 401 when there is no req.user (didn't go through requireAuth)", () => {
    const req = { user: undefined } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRATOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });
});
