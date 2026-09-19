import type { Server } from "socket.io";

/** Registers connection lifecycle handlers on the Socket.IO server. */
export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
