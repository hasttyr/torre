import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";

import { requireAuth, requireRole } from "./auth";
import { HttpError } from "./errorHandler";

function buildReq(headers: Record<string, string> = {}): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
    user: undefined,
  } as unknown as Request;
}

function signValidToken(overrides: Partial<{ sub: string; rol: string }> = {}): string {
  return jwt.sign({ sub: "usuario-1", rol: "ORGANIZADOR", ...overrides }, "test-secret", { expiresIn: "1h" });
}

describe("requireAuth", () => {
  it("attaches req.user and calls next when the token is valid", () => {
    const token = signValidToken();
    const req = buildReq({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(req.user).toEqual({ id: "usuario-1", rol: "ORGANIZADOR" });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with 401 when the Authorization header is missing", () => {
    const req = buildReq();
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });

  it("rejects with 401 when the token is signed with a different secret", () => {
    const token = jwt.sign({ sub: "usuario-1", rol: "ORGANIZADOR" }, "otro-secreto", { expiresIn: "1h" });
    const req = buildReq({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });

  it("rejects with 401 when the token has expired", () => {
    const expired = jwt.sign({ sub: "usuario-1", rol: "ORGANIZADOR" }, "test-secret", { expiresIn: -1 });
    const req = buildReq({ authorization: `Bearer ${expired}` });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });
});

describe("requireRole", () => {
  it("lets the request through when req.user's role is allowed", () => {
    const req = { user: { id: "usuario-1", rol: "ADMINISTRADOR" } } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRADOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with 403 when the role is not allowed", () => {
    const req = { user: { id: "usuario-1", rol: "JUGADOR" } } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRADOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 } satisfies Partial<HttpError>));
  });

  it("rejects with 401 when there is no req.user (didn't go through requireAuth)", () => {
    const req = { user: undefined } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRADOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });
});
