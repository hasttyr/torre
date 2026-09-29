import { pino, type DestinationStream, type Logger } from "pino";

import { env } from "./env";

// Wherever they appear in a logged object: a leaked log must not leak a session.
const REDACTED = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.newPassword",
  "*.token",
  "*.passwordHash",
];

/**
 * A structured (JSON) logger with credentials masked.
 *
 * @param options.destination - Where lines go; standard output by default.
 */
export function createLogger(options: { level?: string; destination?: DestinationStream } = {}): Logger {
  return pino({ level: options.level ?? env.logLevel, redact: { paths: REDACTED } }, options.destination);
}

/** The API's logger: one JSON line per event, ready for a log collector. */
export const logger = createLogger();
