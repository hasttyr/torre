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
  it("adjunta req.user y sigue cuando el token es válido", () => {
    const token = signValidToken();
    const req = buildReq({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(req.user).toEqual({ id: "usuario-1", rol: "ORGANIZADOR" });
    expect(next).toHaveBeenCalledWith();
  });

  it("rechaza con 401 cuando falta el header Authorization", () => {
    const req = buildReq();
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });

  it("rechaza con 401 cuando el token está firmado con otro secreto", () => {
    const token = jwt.sign({ sub: "usuario-1", rol: "ORGANIZADOR" }, "otro-secreto", { expiresIn: "1h" });
    const req = buildReq({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });

  it("rechaza con 401 cuando el token expiró", () => {
    const expired = jwt.sign({ sub: "usuario-1", rol: "ORGANIZADOR" }, "test-secret", { expiresIn: -1 });
    const req = buildReq({ authorization: `Bearer ${expired}` });
    const next = vi.fn();

    requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });
});

describe("requireRole", () => {
  it("deja pasar cuando el rol de req.user está permitido", () => {
    const req = { user: { id: "usuario-1", rol: "ADMINISTRADOR" } } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRADOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("rechaza con 403 cuando el rol no está permitido", () => {
    const req = { user: { id: "usuario-1", rol: "JUGADOR" } } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRADOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 } satisfies Partial<HttpError>));
  });

  it("rechaza con 401 si no hay req.user (no pasó por requireAuth)", () => {
    const req = { user: undefined } as unknown as Request;
    const next = vi.fn();

    requireRole("ADMINISTRADOR")(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 } satisfies Partial<HttpError>));
  });
});
