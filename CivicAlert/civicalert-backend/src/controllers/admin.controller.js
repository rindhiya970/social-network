const User  = require("../models/User.model");
const Issue = require("../models/Issue.model");
const { getIO }            = require("../config/socket");
const { calculatePriority } = require("../utils/sla.utils");
const bcrypt = require("bcryptjs");

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
// Returns system-wide statistics
// ─────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [
      totalIssues, pending, assigned, in_progress, overdue, resolved,
      totalOfficials, activeOfficials,
    ] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: "pending" }),
      Issue.countDocuments({ assignedTo: { $ne: null }, status: { $nin: ["resolved"] } }),
      Issue.countDocuments({ status: "in_progress" }),
      Issue.countDocuments({ status: "overdue" }),
      Issue.countDocuments({ status: "resolved" }),
      User.countDocuments({ role: "official" }),
      User.countDocuments({ role: "official", isActive: true }),
    ]);

    res.status(200).json({
      stats: {
        totalIssues, pending, assigned, in_progress, overdue, resolved,
        totalOfficials, activeOfficials,
      },
    });
  } catch (error) {
    console.error("getDashboard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/officials
// List all officials with their workload counts
// ─────────────────────────────────────────────────────────────
const getOfficials = async (req, res) => {
  try {
    const officials = await User.find({ role: "official" })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();

    // Attach workload counts
    const enriched = await Promise.all(
      officials.map(async (o) => {
        const [assigned, in_progress, resolved] = await Promise.all([
          Issue.countDocuments({ assignedTo: o._id, status: { $nin: ["resolved"] } }),
          Issue.countDocuments({ assignedTo: o._id, status: "in_progress" }),
          Issue.countDocuments({ assignedTo: o._id, status: "resolved" }),
        ]);
        return { ...o, workload: { assigned, in_progress, resolved } };
      })
    );

    res.status(200).json({ officials: enriched });
  } catch (error) {
    console.error("getOfficials error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/officials
// Create a new official account (admin only)
// ─────────────────────────────────────────────────────────────
const createOfficial = async (req, res) => {
  try {
    const { name, email, password, wardId, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const official = new User({
      name,
      email:      email.toLowerCase(),
      passwordHash: password, // hashed by pre-save hook
      role:       "official", // always forced
      wardId:     wardId     || null,
      department: department || null,
      isActive:   true,
    });

    await official.save();

    res.status(201).json({
      message: "Official account created",
      official: official.toJSON(),
    });
  } catch (error) {
    console.error("createOfficial error:", error);
    if (error.name === "ValidationError") {
      const msgs = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: "Validation error", errors: msgs });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/officials/:id
// Update official (ward, department, name, isActive)
// ─────────────────────────────────────────────────────────────
const updateOfficial = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid official ID" });
    }

    const official = await User.findOne({ _id: id, role: "official" });
    if (!official) return res.status(404).json({ message: "Official not found" });

    const { name, wardId, department, isActive } = req.body;

    if (name       !== undefined) official.name       = name;
    if (wardId     !== undefined) official.wardId     = wardId;
    if (department !== undefined) official.department = department;
    if (isActive   !== undefined) official.isActive   = Boolean(isActive);

    await official.save();

    res.status(200).json({
      message: "Official updated",
      official: official.toJSON(),
    });
  } catch (error) {
    console.error("updateOfficial error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/issues
// All issues with full details + filters + workload view
// ─────────────────────────────────────────────────────────────
const getAdminIssues = async (req, res) => {
  try {
    const {
      status, category, priority, wardId,
      assigned, officialId, overdue,
      sort = "newest", page = 1, limit = 50,
    } = req.query;

    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (wardId)   filter.wardId   = wardId;
    if (overdue === "true")  filter.overdue = true;
    if (overdue === "false") filter.overdue = false;
    if (assigned === "true")  filter.assignedTo = { $ne: null };
    if (assigned === "false") filter.assignedTo = null;
    if (officialId) filter.assignedTo = officialId;

    const sortOrder = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
    const pageNum   = Math.max(1, parseInt(page)  || 1);
    const limitNum  = Math.min(100, parseInt(limit) || 50);
    const skip      = (pageNum - 1) * limitNum;

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate("reportedBy", "name email wardId")
        .populate("assignedTo", "name email wardId department")
        .sort(sortOrder)
        .skip(skip)
        .limit(limitNum),
      Issue.countDocuments(filter),
    ]);

    // Workload summary per official
    const workloadRaw = await Issue.aggregate([
      { $match: { assignedTo: { $ne: null }, status: { $nin: ["resolved"] } } },
      {
        $group: {
          _id: "$assignedTo",
          assigned:    { $sum: 1 },
          in_progress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
        },
      },
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      issues,
      workloadSummary: workloadRaw,
    });
  } catch (error) {
    console.error("getAdminIssues error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/issues/:id/assign
// Admin assigns an issue to a specific official + optional scheduledAt
// ─────────────────────────────────────────────────────────────
const assignIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { officialId, scheduledAt } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid issue ID" });
    }
    if (!officialId || !officialId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Valid officialId is required" });
    }

    // Verify official exists, is role=official, and is active
    const official = await User.findById(officialId);
    if (!official)                   return res.status(404).json({ message: "Official not found" });
    if (official.role !== "official") return res.status(400).json({ message: "User is not an official" });
    if (!official.isActive)           return res.status(400).json({ message: "Official account is disabled" });

    // Verify issue exists
    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    issue.assignedTo  = official._id;
    issue.status      = issue.status === "pending" || issue.status === "overdue"
      ? "acknowledged"
      : issue.status;
    if (scheduledAt)  issue.scheduledAt = new Date(scheduledAt);

    // Recalculate priority
    issue.priority           = calculatePriority(issue);
    issue.lastPriorityUpdate = new Date();

    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate("reportedBy", "name email wardId")
      .populate("assignedTo",  "name email wardId department");

    // Real-time: notify citizen + official + admin
    try {
      getIO().to("citizens").emit("issueStatusUpdated", populated.toObject());
    } catch { /* socket not ready */ }

    res.status(200).json({
      message: `Issue assigned to ${official.name}`,
      issue: populated,
    });
  } catch (error) {
    console.error("assignIssue error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/officials/:id
// Permanently delete an official account (admin only)
// Will not delete if official has unresolved assigned issues
// ─────────────────────────────────────────────────────────────
const deleteOfficial = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid official ID" });
    }

    const official = await User.findOne({ _id: id, role: "official" });
    if (!official) return res.status(404).json({ message: "Official not found" });

    // Check for unresolved assigned issues
    const activeIssues = await Issue.countDocuments({
      assignedTo: id,
      status: { $nin: ["resolved"] },
    });

    if (activeIssues > 0) {
      return res.status(409).json({
        message: `Cannot delete: ${activeIssues} unresolved issue(s) are assigned to this official. Reassign or resolve them first.`,
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({ message: `Official "${official.name}" deleted successfully` });
  } catch (error) {
    console.error("deleteOfficial error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getDashboard,
  getOfficials,
  createOfficial,
  updateOfficial,
  deleteOfficial,
  getAdminIssues,
  assignIssue,
};
