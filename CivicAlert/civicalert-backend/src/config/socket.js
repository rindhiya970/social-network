/**
 * Reusable Socket.IO module.
 * Call init(httpServer) once at startup.
 * Call getIO() anywhere to emit events.
 */

const { Server } = require("socket.io");

let io = null;

/**
 * Initialise Socket.IO on the HTTP server.
 * @param {import("http").Server} httpServer
 */
const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",          // tighten in production
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Every connected client joins the shared room
    socket.join("citizens");

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

/**
 * Returns the initialised Socket.IO instance.
 * Throws if init() was not called first.
 */
const getIO = () => {
  if (!io) throw new Error("Socket.IO has not been initialised. Call init() first.");
  return io;
};

module.exports = { init, getIO };
