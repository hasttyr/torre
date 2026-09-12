import { createServer } from "node:http";
import { Server } from "socket.io";

import { createApp } from "./app";
import { env } from "./config/env";
import { registerSocketHandlers } from "./sockets";

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.corsOrigin },
});

registerSocketHandlers(io);

httpServer.listen(env.port, () => {
  console.log(`Torre Central Hub API escuchando en http://localhost:${env.port}`);
});
