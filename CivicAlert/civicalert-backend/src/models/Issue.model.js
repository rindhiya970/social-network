const mongoose = require("mongoose");
const { calculateSLADeadline } = require("../utils/sla.utils");

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["pothole", "garbage", "water", "power", "drainage", "streetlight", "road", "other"],
        message: "Invalid category",
      },
    },

    photoUrl: { type: String, default: null },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: [true, "Location type is required"],
      },
      coordinates: {
        type: [Number],
        required: [true, "Coordinates are required"],
        validate: {
          validator: (coords) =>
            Array.isArray(coords) &&
            coords.length === 2 &&
            coords[0] >= -180 && coords[0] <= 180 &&
            coords[1] >= -90  && coords[1] <= 90,
          message: "Coordinates must be [longitude, latitude] with valid ranges",
        },
      },
    },

    status: {
      type: String,
      enum: { values: ["pending", "acknowledged", "in_progress", "resolved", "overdue"], message: "Invalid status" },
      default: "pending",
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "reportedBy is required"],
    },

    wardId:     { type: String, trim: true, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    upvotes:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    upvoteCount: { type: Number, default: 0 },

    escalated:   { type: Boolean, default: false },

    // ── Phase 7 SLA & Priority fields ─────────────────
    slaDeadline: {
      type: Date,
      default: null,
    },

    overdue:      { type: Boolean, default: false },
    overdueHours: { type: Number,  default: 0 },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },

    lastPriorityUpdate: { type: Date, default: null },

    // AI confidence score (0-100) stored for priority weighting
    aiConfidence: { type: Number, default: 0, min: 0, max: 100 },

    // Admin-scheduled date for when the official should address the issue
    scheduledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ── Pre-save hook: set category-specific SLA on new documents ─────────────
issueSchema.pre("save", function () {
  if (this.isNew && !this.slaDeadline) {
    this.slaDeadline = calculateSLADeadline(this.category, new Date(this.createdAt ?? Date.now()));
  }
});

// ── Indexes ──────────────────────────────────────────────────────────────
issueSchema.index({ location:    "2dsphere" });
issueSchema.index({ status:      1 });
issueSchema.index({ category:    1 });
issueSchema.index({ wardId:      1 });
issueSchema.index({ reportedBy:  1 });
issueSchema.index({ createdAt:  -1 });
issueSchema.index({ slaDeadline: 1 });
issueSchema.index({ overdue:     1 });
issueSchema.index({ priority:    1 });

const Issue = mongoose.model("Issue", issueSchema);
module.exports = Issue;
