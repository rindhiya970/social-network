const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { allowRoles } = require("../middleware/role.middleware");
const {
  createIssue,
  getAllIssues,
  getMyIssues,
  getIssueById,
} = require("../controllers/issue.controller");

const router = express.Router();

// ─────────────────────────────────────────────
// IMPORTANT: /my must be declared BEFORE /:id
// otherwise Express matches "my" as an ObjectId
// ─────────────────────────────────────────────

// @route   GET /api/issues/my
// @desc    Get current user's issues
// @access  Private
router.get("/my", authenticateJWT, getMyIssues);

// @route   GET /api/issues
// @desc    Get all issues (with optional filters)
// @access  Public
router.get("/", getAllIssues);

// @route   POST /api/issues
// @desc    Create a new issue
// @access  Private – citizen only
router.post("/", authenticateJWT, allowRoles("citizen"), createIssue);

// @route   GET /api/issues/:id
// @desc    Get single issue by ID
// @access  Public
router.get("/:id", getIssueById);

module.exports = router;
