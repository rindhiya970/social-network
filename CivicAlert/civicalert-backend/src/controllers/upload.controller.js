const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// ─────────────────────────────────────────────
// @route   POST /api/upload
// @desc    Upload image to Cloudinary
// @access  Private – authenticated users
// ─────────────────────────────────────────────
const uploadImage = (req, res) => {
  // Multer already ran — check that a file was provided
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided" });
  }

  // Stream the buffer from memory to Cloudinary
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: "civicalert/issues",
      resource_type: "image",
      transformation: [
        { width: 1200, crop: "limit" },   // cap width at 1200px
        { quality: "auto:good" },          // smart compression
        { fetch_format: "auto" },          // serve WebP where supported
      ],
    },
    (error, result) => {
      if (error) {
        console.error("Cloudinary upload error:", error);
        return res.status(500).json({
          message: "Image upload failed",
          error: error.message,
        });
      }

      return res.status(200).json({
        photoUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      });
    }
  );

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
};

module.exports = { uploadImage };
