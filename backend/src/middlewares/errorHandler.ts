import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Recurso no encontrado" });
}

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

  // Un error no controlado (p. ej. Postgres caído) puede traer mensajes con
  // rutas de archivo, stack traces o detalles del driver. Eso se registra
  // en el servidor, nunca se devuelve al cliente.
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
