import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
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

/** Express middleware: rejects the request unless it carries a valid JWT, and populates `req.user`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next(new HttpError(401, "No autenticado"));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      throw new Error("unexpected token payload shape");
    }
    req.user = { id: payload.sub, role: payload.role } satisfies AuthUser;
    next();
  } catch {
    next(new HttpError(401, "Token inválido o expirado"));
  }
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
