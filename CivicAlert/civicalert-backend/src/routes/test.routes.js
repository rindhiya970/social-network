const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { allowRoles } = require("../middleware/role.middleware");
const User = require("../models/User.model");
const Issue = require("../models/Issue.model");

const router = express.Router();

// @route   POST /api/test/reset
// @desc    Reset test database (unresolved/test mode only)
// @access  Public (Test mode only)
router.post("/reset", async (req, res) => {
  const isTestMode = process.env.NODE_ENV === "test";
  const hasSecret = process.env.E2E_SECRET &&
    req.headers["x-e2e-secret"] === process.env.E2E_SECRET;

  if (!isTestMode && !hasSecret) {
    return res.status(403).json({ message: "Reset only allowed in test mode" });
  }
  try {
    await User.deleteMany({});
    await Issue.deleteMany({});

    // Seed default official user for E2E tests
    const official = new User({
      name: "Official Bob",
      email: "officer@test.com",
      passwordHash: "password123", // schema pre-save hook will hash it
      role: "official",
      wardId: "Ward-1",
    });
    await official.save();

    res.status(200).json({ message: "Test database reset and official user seeded successfully" });
  } catch (error) {
    res.status(500).json({ message: "Database reset failed", error: error.message });
  }
});

// @route   GET /api/test/citizen
// @desc    Test route accessible by citizens
// @access  Private (citizen only)
router.get("/citizen", authenticateJWT, allowRoles("citizen"), (req, res) => {
  res.status(200).json({
    message: "✅ Citizen route accessed successfully",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// @route   GET /api/test/official
// @desc    Test route accessible by officials
// @access  Private (official only)
router.get("/official", authenticateJWT, allowRoles("official"), (req, res) => {
  res.status(200).json({
    message: "✅ Official route accessed successfully",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// @route   GET /api/test/admin
// @desc    Test route accessible by admins
// @access  Private (admin only)
router.get("/admin", authenticateJWT, allowRoles("admin"), (req, res) => {
  res.status(200).json({
    message: "✅ Admin route accessed successfully",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;
