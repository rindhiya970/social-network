const Issue = require("../models/Issue.model");

// ─────────────────────────────────────────────
// @route   POST /api/issues
// @desc    Create a new issue (citizen only)
// @access  Private – citizen
// ─────────────────────────────────────────────
const createIssue = async (req, res) => {
  try {
    const { title, description, category, photoUrl, location, wardId } = req.body;

    // --- Required field validation ---
    if (!title || !description || !category) {
      return res.status(400).json({
        message: "title, description, and category are required",
      });
    }

    // --- Location validation ---
    if (!location || !location.type || !location.coordinates) {
      return res.status(400).json({
        message: "location is required with type 'Point' and coordinates [longitude, latitude]",
      });
    }

    if (location.type !== "Point") {
      return res.status(400).json({ message: "location.type must be 'Point'" });
    }

    const { coordinates } = location;
    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      typeof coordinates[0] !== "number" ||
      typeof coordinates[1] !== "number" ||
      coordinates[0] < -180 || coordinates[0] > 180 ||
      coordinates[1] < -90  || coordinates[1] > 90
    ) {
      return res.status(400).json({
        message: "coordinates must be [longitude, latitude] with valid ranges: longitude -180..180, latitude -90..90",
      });
    }

    const issue = new Issue({
      title,
      description,
      category,
      photoUrl: photoUrl || null,
      location: {
        type: "Point",
        coordinates,
      },
      wardId: wardId || req.user.wardId || null,
      // Fields automatically set — not from request body
      reportedBy: req.user._id,
      status: "pending",
      slaDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });

    await issue.save();

    // Populate reporter info before responding
    await issue.populate("reportedBy", "name email role wardId");

    res.status(201).json({
      message: "Issue reported successfully",
      issue,
    });
  } catch (error) {
    console.error("createIssue error:", error);

    // Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: "Validation error", errors: messages });
    }

    res.status(500).json({ message: "Server error while creating issue", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/issues
// @desc    Get all issues (public) with filters
// @access  Public
// ─────────────────────────────────────────────
const getAllIssues = async (req, res) => {
  try {
    const { status, category, wardId, page = 1, limit = 20 } = req.query;

    // Build filter object
    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (wardId)   filter.wardId   = wardId;

    // Validate enum values if provided
    const validStatuses   = ["pending", "acknowledged", "in_progress", "resolved", "overdue"];
    const validCategories = ["pothole", "garbage", "water", "power", "drainage", "streetlight", "road", "other"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status filter. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        message: `Invalid category filter. Must be one of: ${validCategories.join(", ")}`,
      });
    }

    // Pagination
    const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 20); // cap at 100
    const skip     = (pageNum - 1) * limitNum;

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate("reportedBy", "name email wardId")
        .populate("assignedTo", "name email")
        .sort({ createdAt: -1 }) // newest first
        .skip(skip)
        .limit(limitNum),
      Issue.countDocuments(filter),
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      issues,
    });
  } catch (error) {
    console.error("getAllIssues error:", error);
    res.status(500).json({ message: "Server error while fetching issues", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/issues/my
// @desc    Get issues reported by current user
// @access  Private – authenticated citizen
// ─────────────────────────────────────────────
const getMyIssues = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;

    const filter = { reportedBy: req.user._id };
    if (status)   filter.status   = status;
    if (category) filter.category = category;

    const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 20);
    const skip     = (pageNum - 1) * limitNum;

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate("assignedTo", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Issue.countDocuments(filter),
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      issues,
    });
  } catch (error) {
    console.error("getMyIssues error:", error);
    res.status(500).json({ message: "Server error while fetching your issues", error: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/issues/:id
// @desc    Get single issue by ID
// @access  Public
// ─────────────────────────────────────────────
const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format before querying
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid issue ID format" });
    }

    const issue = await Issue.findById(id)
      .populate("reportedBy", "name email wardId")
      .populate("assignedTo", "name email");

    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    res.status(200).json({ issue });
  } catch (error) {
    console.error("getIssueById error:", error);
    res.status(500).json({ message: "Server error while fetching issue", error: error.message });
  }
};

module.exports = {
  createIssue,
  getAllIssues,
  getMyIssues,
  getIssueById,
};
