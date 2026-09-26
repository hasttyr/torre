import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import type { AuthUser } from "../types/express";
import { HttpError } from "./errorHandler";

/** Pulls the bearer token out of the Authorization header, if present. */
function extractToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim();
}

/** Verifies the token's signature and expiry and returns its claims. */
function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      throw new Error("unexpected token payload shape");
    }
    return { id: payload.sub, role: payload.role };
  } catch {
    throw new HttpError(401, "Token inválido o expirado");
  }
}

/**
 * Checks that the token's claims still hold: the account exists, is ACTIVE
 * and still has the role the token carries. Without this, a blocked account
 * (admin action, HU22 suppression) or a changed role (HU03) would keep
 * working until the token expired. One primary-key lookup per request.
 */
async function assertSessionStillValid(user: AuthUser): Promise<void> {
  const current = await prisma.user.findFirst({
    where: { id: user.id, status: "ACTIVE", role: { name: user.role } },
    select: { id: true },
  });
  if (!current) {
    throw new HttpError(401, "Tu sesión ya no es válida: volvé a iniciar sesión");
  }
}

async function authenticate(req: Request): Promise<AuthUser> {
  const token = extractToken(req);
  if (!token) {
    throw new HttpError(401, "No autenticado");
  }
  const user = verifyToken(token);
  await assertSessionStillValid(user);
  return user;
}

/** Express middleware: rejects the request unless it carries a valid, still-current JWT, and populates `req.user`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  authenticate(req).then((user) => {
    req.user = user;
    next();
  }, next);
}

/** Express middleware factory: rejects the request unless `req.user.role` is one of the given roles. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, "No autenticado"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "No tenés permiso para esta acción"));
      return;
    }
    next();
  };
}
