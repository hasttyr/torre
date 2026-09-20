import { createServer } from "node:http";
import { Server } from "socket.io";

import { createApp } from "./app";
import { env } from "./config/env";
import { registerSocketHandlers } from "./sockets";
import { setSocketServer } from "./sockets/broadcast";

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.corsOrigin },
});

registerSocketHandlers(io);
setSocketServer(io);

httpServer.listen(env.port, () => {
  console.log(`Torre Central Hub API listening on http://localhost:${env.port}`);
});
