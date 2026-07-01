const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

// Load environment variables FIRST
dotenv.config();

// Now load modules that depend on environment variables
const connectDB = require("./config/db");
const passport = require("./config/passport");

// Import routes
const authRoutes   = require("./routes/auth.routes");
const testRoutes   = require("./routes/test.routes");
const issueRoutes  = require("./routes/issue.routes");
const uploadRoutes = require("./routes/upload.routes");

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    message: "CivicAlert Backend API Running 🚀",
    version: "1.0.0",
    endpoints: {
      auth:   "/api/auth",
      issues: "/api/issues",
      upload: "/api/upload",
      test:   "/api/test",
    },
  });
});

app.use("/api/auth",   authRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/test",   testRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 API available at http://localhost:${PORT}`);
});