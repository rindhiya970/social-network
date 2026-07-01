const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const { uploadImage } = require("../controllers/upload.controller");

const router = express.Router();

// Multer error handler — wraps the route so multer errors return clean JSON
const handleMulterError = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      // Multer-specific errors
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Maximum size is 5 MB." });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// @route   POST /api/upload
// @desc    Upload a single image to Cloudinary
// @access  Private – authenticated users
// @field   image (multipart/form-data)
router.post("/", authenticateJWT, handleMulterError, uploadImage);

module.exports = router;
