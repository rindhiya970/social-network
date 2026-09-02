const Issue = require("../models/Issue.model");
const { getIO } = require("../config/socket");
const { calculatePriority } = require("../utils/sla.utils");

const VALID_STATUSES   = ["pending", "acknowledged", "in_progress", "resolved", "overdue"];
const VALID_CATEGORIES = ["pothole", "garbage", "water", "power", "drainage", "streetlight", "road", "other"];

const ALLOWED_TRANSITIONS = {
  pending:      ["acknowledged"],
  acknowledged: ["in_progress"],
  in_progress:  ["resolved"],
  resolved:     [],
  overdue:      ["acknowledged", "in_progress"],
};

// ─────────────────────────────────────────────
// @route   GET /api/official/issues
// @desc    Return two buckets:
//          1. unassigned pending issues (ward-matched OR no wardId)
//          2. issues already assigned to this official
// @access  Private – official
// ─────────────────────────────────────────────
const getOfficialIssues = async (req, res) => {
  try {
    const { category, sort = "newest", page = 1, limit = 50 } = req.query;
    const official = req.user;

    const sortOrder = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
    const pageNum   = Math.max(1, parseInt(page, 10) || 1);
    const limitNum  = Math.min(100, parseInt(limit, 10) || 50);
    const skip      = (pageNum - 1) * limitNum;

    // ── Bucket 1: unassigned issues visible to this official
    // Includes both pending AND overdue unassigned issues
    const pendingFilter = {
      status:     { $in: ["pending", "overdue"] },
      assignedTo: null,
      ...(official.wardId
        ? { $or: [{ wardId: official.wardId }, { wardId: null }] }
        : {}),
    };
    if (category && VALID_CATEGORIES.includes(category)) {
      pendingFilter.category = category;
    }

    // ── Bucket 2: issues already assigned to THIS official (any status)
    const assignedFilter = {
      assignedTo: official._id,
    };
    if (category && VALID_CATEGORIES.includes(category)) {
      assignedFilter.category = category;
    }

    const [pendingIssues, assignedIssues] = await Promise.all([
      Issue.find(pendingFilter)
        .populate("reportedBy", "name email wardId")
        .sort(sortOrder)
        .skip(skip)
        .limit(limitNum),
      Issue.find(assignedFilter)
        .populate("reportedBy", "name email wardId")
        .populate("assignedTo",  "name email")
        .sort(sortOrder),
    ]);

    // Stats across both buckets for this official's scope
    const statsFilter = official.wardId
      ? { $or: [{ wardId: official.wardId }, { wardId: null }, { assignedTo: official._id }] }
      : {};

    const [pending, acknowledged, in_progress, resolved, overdue, total] = await Promise.all([
      Issue.countDocuments({ ...statsFilter, status: "pending"      }),
      Issue.countDocuments({ ...statsFilter, status: "acknowledged" }),
      Issue.countDocuments({ ...statsFilter, status: "in_progress"  }),
      Issue.countDocuments({ ...statsFilter, status: "resolved"     }),
      Issue.countDocuments({ ...statsFilter, status: "overdue"      }),
      Issue.countDocuments(statsFilter),
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      stats: { pending, acknowledged, in_progress, resolved, overdue },
      pendingIssues,
      assignedIssues,
      issues: [...pendingIssues, ...assignedIssues],
    });
  } catch (error) {
    console.error("getOfficialIssues error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/official/issues/:id
// ─────────────────────────────────────────────
const getOfficialIssueById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid issue ID format" });
    }

    const issue = await Issue.findById(id)
      .populate("reportedBy", "name email wardId")
      .populate("assignedTo",  "name email");

    if (!issue) return res.status(404).json({ message: "Issue not found" });

    res.status(200).json({ issue });
  } catch (error) {
    console.error("getOfficialIssueById error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/official/issues/:id/status
// When transitioning from pending → acknowledged:
//   assignedTo is set to the official's ID
// ─────────────────────────────────────────────
const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid issue ID format" });
    }
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const allowed = ALLOWED_TRANSITIONS[issue.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return res.status(422).json({
        message: `Invalid transition: ${issue.status} → ${newStatus}. Allowed: ${allowed.join(", ") || "none"}`,
        currentStatus:      issue.status,
        allowedTransitions: allowed,
      });
    }

    issue.status = newStatus;

    // NOTE: Auto-assign removed — only Admin can assign issues.
    // If an issue somehow reaches "acknowledged" without assignedTo, set it now.
    if (newStatus === "acknowledged" && !issue.assignedTo) {
      issue.assignedTo = req.user._id;
    }

    // Recalculate priority after status change
    issue.priority = calculatePriority(issue);
    issue.lastPriorityUpdate = new Date();

    // If resolved, clear overdue flag
    if (newStatus === "resolved") {
      issue.overdue      = false;
      issue.overdueHours = 0;
    }

    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate("reportedBy", "name email wardId")
      .populate("assignedTo",  "name email");

    try {
      getIO().to("citizens").emit("issueStatusUpdated", populated.toObject());
    } catch { /* socket not ready */ }

    res.status(200).json({
      message: `Issue status updated to ${newStatus}`,
      issue:   populated,
    });
  } catch (error) {
    console.error("updateIssueStatus error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { getOfficialIssues, getOfficialIssueById, updateIssueStatus };
