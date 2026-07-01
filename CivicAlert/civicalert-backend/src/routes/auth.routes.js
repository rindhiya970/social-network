const express = require("express");
const { register, login, getMe } = require("../controllers/auth.controller");
const { authenticateJWT } = require("../middleware/auth.middleware");

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new citizen user
// @access  Public
router.post("/register", register);

// @route   POST /api/auth/login
// @desc    Login user and return JWT token
// @access  Public
router.post("/login", login);

// @route   GET /api/auth/me
// @desc    Get currently logged-in user
// @access  Private
router.get("/me", authenticateJWT, getMe);

module.exports = router;
