import { randomUUID } from "node:crypto";

import type { Request } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

// An id a proxy or client assigned is kept only if it's short and plain.
const FORWARDED_ID = /^[\w.-]{1,100}$/;

/**
 * Logs every request once it's answered: its id (echoed in `X-Request-Id`,
 * to correlate a report with its log line), method, path, status, time, and
 * the user once authenticated, and the client's address as the app resolves
 * it (behind TRUST_PROXY, the forwarded one: the log shows whether the proxy
 * hops are set right). Handlers log through `req.log`, which carries the same id.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const forwarded = req.headers["x-request-id"];
      const id = typeof forwarded === "string" && FORWARDED_ID.test(forwarded) ? forwarded : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    customProps: (req) => ({ userId: (req as Request).user?.id, ip: (req as Request).ip }),
  });
}
