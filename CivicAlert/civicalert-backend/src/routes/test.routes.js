const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { allowRoles } = require("../middleware/role.middleware");

const router = express.Router();

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
