const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { allowRoles }      = require("../middleware/role.middleware");
const {
  getOfficialIssues,
  getOfficialIssueById,
  updateIssueStatus,
} = require("../controllers/official.controller");

const router = express.Router();

// All routes require authentication AND official role
router.use(authenticateJWT, allowRoles("official", "admin"));

// @route   GET /api/official/issues
router.get("/issues", getOfficialIssues);

// @route   GET /api/official/issues/:id
router.get("/issues/:id", getOfficialIssueById);

// @route   PATCH /api/official/issues/:id/status
router.patch("/issues/:id/status", updateIssueStatus);

module.exports = router;
