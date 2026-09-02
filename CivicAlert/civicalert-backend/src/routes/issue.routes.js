const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { allowRoles } = require("../middleware/role.middleware");
const {
  createIssue,
  getAllIssues,
  getMyIssues,
  getIssueById,
  toggleUpvote,
} = require("../controllers/issue.controller");

const router = express.Router();

// ─────────────────────────────────────────────
// IMPORTANT: /my must be declared BEFORE /:id
// otherwise Express matches "my" as an ObjectId
// ─────────────────────────────────────────────

// @route   GET /api/issues/my
router.get("/my", authenticateJWT, getMyIssues);

// @route   GET /api/issues
router.get("/", getAllIssues);

// @route   POST /api/issues
router.post("/", authenticateJWT, allowRoles("citizen"), createIssue);

// @route   POST /api/issues/:id/upvote
// @desc    Toggle upvote (citizen only, cannot upvote own issue)
router.post("/:id/upvote", authenticateJWT, allowRoles("citizen"), toggleUpvote);

// @route   GET /api/issues/:id
router.get("/:id", getIssueById);

module.exports = router;
