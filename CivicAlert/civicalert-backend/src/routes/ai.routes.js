const express = require("express");
const multer = require("multer");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { analyzeIssue } = require("../controllers/ai.controller");

const router = express.Router();

// In-memory multer for AI image analysis
// Accepts same image types as upload route, 5 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."), false);
    }
  },
});

// Wrap multer errors into clean JSON responses
const handleMulter = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image too large. Maximum size is 5 MB." });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// @route   POST /api/ai/analyze-issue
// @desc    Analyze a civic issue photo with Gemini Vision
// @access  Private – authenticated users
router.post("/analyze-issue", handleMulter, authenticateJWT, analyzeIssue);

module.exports = router;
