const mongoose = require("mongoose");

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
        values: [
          "pothole",
          "garbage",
          "water",
          "power",
          "drainage",
          "streetlight",
          "road",
          "other",
        ],
        message: "Invalid category. Must be one of: pothole, garbage, water, power, drainage, streetlight, road, other",
      },
    },

    photoUrl: {
      type: String,
      default: null,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: [true, "Location type is required"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, "Coordinates are required"],
        validate: {
          validator: function (coords) {
            return (
              Array.isArray(coords) &&
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 && // longitude
              coords[1] >= -90 &&
              coords[1] <= 90   // latitude
            );
          },
          message: "Coordinates must be [longitude, latitude] with valid ranges",
        },
      },
    },

    status: {
      type: String,
      enum: {
        values: ["pending", "acknowledged", "in_progress", "resolved", "overdue"],
        message: "Invalid status",
      },
      default: "pending",
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "reportedBy is required"],
    },

    wardId: {
      type: String,
      trim: true,
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    upvoteCount: {
      type: Number,
      default: 0,
    },

    escalated: {
      type: Boolean,
      default: false,
    },

    slaDeadline: {
      type: Date,
      default: () => new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index for location-based queries
issueSchema.index({ location: "2dsphere" });

// Additional indexes for common query patterns
issueSchema.index({ status: 1 });
issueSchema.index({ category: 1 });
issueSchema.index({ wardId: 1 });
issueSchema.index({ reportedBy: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ slaDeadline: 1 });

const Issue = mongoose.model("Issue", issueSchema);

module.exports = Issue;
