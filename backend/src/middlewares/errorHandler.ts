import type { NextFunction, Request, Response } from "express";

import { logger } from "../config/logger";
import type { ApiErrorBody } from "../contracts/errors";
import { HttpError, type ApiErrorCode } from "../errors/apiErrors";

/** The response body for an error: its message, its code, and what filled the message. */
export function errorBody(error: HttpError): ApiErrorBody {
  return {
    error: error.message,
    code: error.code,
    ...(Object.keys(error.params).length > 0 ? { params: error.params } : {}),
    ...(error.fields ? { fields: error.fields } : {}),
  };
}

/** Express fallback handler for routes that don't match any registered route. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json(errorBody(new HttpError("NOT_FOUND")));
}

/**
 * An error raised by Express's own middleware (the JSON body parser, through
 * `http-errors`) about the request itself: `expose` marks it as safe to show,
 * and its 4xx status as the client's mistake rather than an outage.
 */
interface ClientRequestError {
  status: number;
  type?: string;
}

function isClientRequestError(err: unknown): err is ClientRequestError {
  if (typeof err !== "object" || err === null) return false;
  const { expose, status } = err as { expose?: unknown; status?: unknown };
  return expose === true && typeof status === "number" && status >= 400 && status < 500;
}

// Keyed by the body parser's error `type`. Its own messages are English and
// technical, so they're replaced instead of passed through.
const CLIENT_REQUEST_CODES: Record<string, ApiErrorCode> = {
  "entity.parse.failed": "INVALID_JSON",
  "entity.too.large": "PAYLOAD_TOO_LARGE",
};

/**
 * Express error-handling middleware. Known {@link HttpError}s are reported
 * to the client with their own status, code and message, and so are the
 * request errors Express itself raises (malformed or oversized body);
 * anything else is logged server-side and reported as a generic 500.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json(errorBody(err));
    return;
  }

  if (isClientRequestError(err)) {
    const code = (err.type && CLIENT_REQUEST_CODES[err.type]) || "BAD_REQUEST";
    res.status(err.status).json(errorBody(new HttpError(code)));
    return;
  }

  // An uncaught error (e.g. Postgres down) can carry file paths, stack
  // traces or driver details in its message. That gets logged server-side
  // (with the request's id, when it went through the request logger), never
  // returned to the client.
  (req.log ?? logger).error({ err }, "unexpected error");
  res.status(500).json(errorBody(new HttpError("INTERNAL_ERROR")));
}
