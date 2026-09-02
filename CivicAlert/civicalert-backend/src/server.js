const http    = require("http");
const dotenv  = require("dotenv");

// Load environment variables FIRST
dotenv.config();

// Load modules that depend on environment variables
const connectDB = require("./config/db");
const socket    = require("./config/socket");
const { startSLAScheduler } = require("./jobs/slaScheduler");
const app       = require("./app");

// Connect to MongoDB
connectDB();

// Create HTTP server and attach Socket.IO
const httpServer = http.createServer(app);
socket.init(httpServer);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 API available at http://localhost:${PORT}`);
  console.log(`⚡ Socket.IO ready`);
  startSLAScheduler();
});
