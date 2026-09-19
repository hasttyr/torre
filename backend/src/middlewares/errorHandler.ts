import type { NextFunction, Request, Response } from "express";

/** An error with an explicit HTTP status, safe to surface to the client as-is. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Express fallback handler for routes that don't match any registered route. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Recurso no encontrado" });
}

/**
 * Express error-handling middleware. Known {@link HttpError}s are reported
 * to the client with their own status and message; anything else is logged
 * server-side and reported as a generic 500.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // An uncaught error (e.g. Postgres down) can carry file paths, stack
  // traces or driver details in its message. That gets logged server-side,
  // never returned to the client.
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
