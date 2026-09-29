import { createServer, type Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { PostgresRateLimitStore } from "./middlewares/rateLimitStore";
import { registerSocketHandlers } from "./sockets";
import { resetSocketServer, setSocketServer } from "./sockets/broadcast";

export interface RunningServer {
  httpServer: HttpServer;
  /** Stops accepting connections, drops the sockets, finishes in-flight requests and closes the database pool. */
  stop(): Promise<void>;
}

/** Starts the REST API and the Socket.IO channel on `port` (0 = any free port). */
export async function startServer(port: number): Promise<RunningServer> {
  // The sign-in limits count in the database: shared by every instance, kept across restarts.
  const app = createApp({ rateLimitStore: (prefix) => new PostgresRateLimitStore(prisma, prefix) });
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: env.corsOrigin } });
  registerSocketHandlers(io);
  setSocketServer(io);
  await new Promise<void>((resolve) => httpServer.listen(port, resolve));

  return {
    httpServer,
    async stop() {
      resetSocketServer();
      // Closing Socket.IO also closes the HTTP server: no new connections,
      // and it resolves once the requests in flight have been answered.
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await prisma.$disconnect();
    },
  };
}

async function main(): Promise<void> {
  process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "unhandled promise rejection"));
  const server = await startServer(env.port);
  logger.info({ port: env.port }, "Torre Central Hub API listening");

  // A deploy or restart sends SIGTERM (Ctrl+C, SIGINT): finish cleanly
  // instead of dropping requests and connections mid-way.
  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error({ err: error }, "shutdown failed");
        process.exit(1);
      },
    );
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

// Run as the entry point (`node dist/server.js`, `tsx src/server.ts`), not when imported by a test.
if (require.main === module) {
  main().catch((error: unknown) => {
    logger.fatal({ err: error }, "could not start");
    process.exit(1);
  });
}
